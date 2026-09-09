import UIKit
import AVFoundation
import Vision
import PhotosUI
import ImageIO

private final class ScanGate {
    private let lock = NSLock()
    private var version = 0, active = false, photo = false
    private var size = CGSize.zero
    @discardableResult func change(active: Bool? = nil, photo: Bool? = nil) -> Int {
        lock.lock(); defer { lock.unlock() }; version += 1
        if let active { self.active = active }; if let photo { self.photo = photo }; return version
    }
    func liveToken() -> Int? { lock.lock(); defer { lock.unlock() }; return active && !photo ? version : nil }
    func valid(_ token: Int) -> Bool { lock.lock(); defer { lock.unlock() }; return active && version == token }
    func setSize(_ size: CGSize) { lock.lock(); self.size = size; lock.unlock() }
    func previewSize() -> CGSize { lock.lock(); defer { lock.unlock() }; return size }
}
enum ScanGeometry {
    static func guide(_ size: CGSize) -> CGRect {
        let h = min(size.height * 0.72, size.width * 0.62 * 88 / 63), w = h * 63 / 88
        return CGRect(x: (size.width-w)/2, y: (size.height-h)/2, width: w, height: h)
    }
    static func crop(frame: CGSize, preview: CGSize) -> CGRect {
        guard preview.width > 0, preview.height > 0, frame.width > 0, frame.height > 0 else { return CGRect(origin: .zero, size: frame) }
        let scale = min(preview.width/frame.width, preview.height/frame.height), guide = guide(preview)
        let w = min(frame.width, ceil(guide.width*1.3/scale)), h = min(frame.height, ceil(guide.height*1.3/scale))
        return CGRect(x: floor((frame.width-w)/2), y: floor((frame.height-h)/2), width: w, height: h)
    }
}
private final class CameraPreview: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}
private final class CardGuide: UIView {
    override func draw(_ rect: CGRect) {
        let guide = ScanGeometry.guide(bounds.size)
        let path = UIBezierPath(roundedRect: guide, cornerRadius: 14)
        UIColor(red: 185/255, green: 243/255, blue: 107/255, alpha: 1).setStroke(); path.lineWidth = 2; path.stroke()
    }
}

final class ScannerViewController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate, PHPickerViewControllerDelegate {
    var onPick: ((String?) -> Void)?
    private let preview = CameraPreview(), guide = CardGuide(), photoView = UIImageView()
    private let status = UILabel(), hint = UILabel(), zoomLabel = UILabel(), candidates = UIStackView(), slider = UISlider()
    private let session = AVCaptureSession(), output = AVCaptureVideoDataOutput()
    private let cameraQueue = DispatchQueue(label: "holo.camera"), analysisQueue = DispatchQueue(label: "holo.analysis", qos: .userInitiated)
    private let gate = ScanGate(), context = CIContext(options: [.cacheIntermediates: false])
    private var device: AVCaptureDevice?, configured = false, toolsReady = false, photoMode = false, visible = false, picked = false
    private var catalogue: CardCatalogue?, vision: HoloVision?
    private var previous: String?, streak = 0, lastResultAt: CFTimeInterval = 0, lastToken = -1, lastFrameAt: CFTimeInterval = 0
    private var lastFocus: CFTimeInterval = 0
    private let green = UIColor(red: 185/255, green: 243/255, blue: 107/255, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = UIColor(red: 13/255, green: 20/255, blue: 18/255, alpha: 1)
        buildUI()
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(foreground), name: UIApplication.didBecomeActiveNotification, object: nil)
        analysisQueue.async { [weak self] in
            guard let self else { return }
            do {
                self.catalogue = try CardCatalogue()
                self.vision = HoloVision(indexPath: CardCatalogue.assets.appendingPathComponent("image-index.bin").path, localPath: CardCatalogue.assets.appendingPathComponent("local-index.bin").path)
                DispatchQueue.main.async { [weak self] in guard let self else { return }; self.toolsReady = true; self.status.text = "對準卡片，即可開始"; if self.visible { self.requestCamera() } }
            } catch { DispatchQueue.main.async { [weak self] in self?.status.text = "無法讀取內置卡庫，請返回卡庫搜尋。" } }
        }
    }
    private func buildUI() {
        let column = UIStackView(); column.axis = .vertical; column.spacing = 10; column.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(column)
        NSLayoutConstraint.activate([column.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16), column.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16), column.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8), column.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8)])
        let head = UIStackView(); head.axis = .horizontal
        let title = UILabel(); title.text = "HOLO / SCAN"; title.font = .systemFont(ofSize: 16, weight: .bold); title.textColor = green; head.addArrangedSubview(title)
        head.addArrangedSubview(button("完成", action: #selector(close))); column.addArrangedSubview(head)
        preview.previewLayer.session = session; preview.previewLayer.videoGravity = .resizeAspect; preview.clipsToBounds = true; preview.layer.cornerRadius = 20
        column.addArrangedSubview(preview); preview.heightAnchor.constraint(greaterThanOrEqualToConstant: 140).isActive = true
        photoView.contentMode = .scaleAspectFit; photoView.isHidden = true
        for overlay in [photoView, guide] { overlay.translatesAutoresizingMaskIntoConstraints = false; preview.addSubview(overlay); NSLayoutConstraint.activate([overlay.leadingAnchor.constraint(equalTo: preview.leadingAnchor), overlay.trailingAnchor.constraint(equalTo: preview.trailingAnchor), overlay.topAnchor.constraint(equalTo: preview.topAnchor), overlay.bottomAnchor.constraint(equalTo: preview.bottomAnchor)]) }
        guide.backgroundColor = .clear; guide.isUserInteractionEnabled = false
        preview.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped(_:))))
        preview.isAccessibilityElement = true; preview.accessibilityLabel = "卡片取景區"; preview.accessibilityHint = "使用下方對焦按鈕重新對焦"
        status.text = "正在啟動內置辨識…"; status.font = .preferredFont(forTextStyle: .headline); status.textColor = .white; status.numberOfLines = 2; column.addArrangedSubview(status)
        hint.text = "拉遠手機，用 2× 取景；點按卡片對焦。"; hint.font = .preferredFont(forTextStyle: .subheadline); hint.textColor = .lightGray; hint.numberOfLines = 2; column.addArrangedSubview(hint)
        let scroll = UIScrollView(); scroll.heightAnchor.constraint(equalToConstant: 94).isActive = true
        candidates.axis = .vertical; candidates.spacing = 6; candidates.translatesAutoresizingMaskIntoConstraints = false; scroll.addSubview(candidates)
        NSLayoutConstraint.activate([candidates.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor), candidates.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor), candidates.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor), candidates.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor), candidates.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor)])
        column.addArrangedSubview(scroll)
        let actions = UIStackView(arrangedSubviews: [button("選擇相片", action: #selector(photos)), button("鏡頭", action: #selector(live)), button("補光", action: #selector(torch))]); actions.distribution = .fillEqually; actions.spacing = 6; column.addArrangedSubview(actions)
        let zoom = UIStackView(arrangedSubviews: [button("1×", action: #selector(one)), button("2×", action: #selector(two)), button("對焦", action: #selector(refocus)), zoomLabel]); zoom.distribution = .fillEqually; zoom.spacing = 6; column.addArrangedSubview(zoom)
        zoomLabel.text = "2.0×"; zoomLabel.textColor = green; zoomLabel.textAlignment = .center
        slider.minimumValue = 1; slider.maximumValue = 4; slider.value = 2; slider.tintColor = green; slider.accessibilityLabel = "鏡頭變焦倍率"; slider.addTarget(self, action: #selector(slid), for: .valueChanged); column.addArrangedSubview(slider)
    }
    private func button(_ title: String, action: Selector) -> UIButton {
        let button = UIButton(type: .system); button.setTitle(title, for: .normal); button.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        button.setTitleColor(green, for: .normal); button.backgroundColor = UIColor(red: 28/255, green: 40/255, blue: 33/255, alpha: 1); button.layer.cornerRadius = 12
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true; button.addTarget(self, action: action, for: .touchUpInside); return button
    }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); gate.setSize(preview.bounds.size); guide.setNeedsDisplay() }
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); visible = true; gate.change(active: true, photo: photoMode); UIApplication.shared.isIdleTimerDisabled = true; if toolsReady && !photoMode { requestCamera() } }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); visible = false; pause(); UIApplication.shared.isIdleTimerDisabled = false }
    @objc private func background() { pause() }
    @objc private func foreground() { guard visible, !picked else { return }; gate.change(active: true, photo: photoMode); if toolsReady && !photoMode { requestCamera() } }
    private func pause() { gate.change(active: false); cameraQueue.async { [weak self] in self?.session.stopRunning() } }
    private func requestCamera() {
        guard visible, !photoMode, !picked else { return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: startCamera()
        case .notDetermined: AVCaptureDevice.requestAccess(for: .video) { [weak self] ok in DispatchQueue.main.async { if ok { self?.requestCamera() } else { self?.status.text = "未允許鏡頭，仍可選擇相片辨識。" } } }
        default: status.text = "未允許鏡頭；可選相片，或到設定開啟鏡頭權限。"
        }
    }
    private func startCamera() {
        gate.change(active: true, photo: false)
        cameraQueue.async { [weak self] in
            guard let self else { return }
            do {
                if !self.configured {
                    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else { throw NSError(domain: "Camera", code: 1) }
                    let input = try AVCaptureDeviceInput(device: device)
                    self.session.beginConfiguration()
                    self.session.sessionPreset = self.session.canSetSessionPreset(.hd1920x1080) ? .hd1920x1080 : .high
                    guard self.session.canAddInput(input), self.session.canAddOutput(self.output) else { self.session.commitConfiguration(); throw NSError(domain: "Camera", code: 2) }
                    self.session.addInput(input); self.output.alwaysDiscardsLateVideoFrames = true
                    self.output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
                    self.output.setSampleBufferDelegate(self, queue: self.analysisQueue); self.session.addOutput(self.output)
                    if let c = self.output.connection(with: .video), c.isVideoRotationAngleSupported(90) { c.videoRotationAngle = 90 }
                    self.session.commitConfiguration(); self.device = device; self.configured = true
                    try device.lockForConfiguration()
                    if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
                    if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
                    device.isSubjectAreaChangeMonitoringEnabled = true; device.unlockForConfiguration()
                    let stored = UserDefaults.standard.float(forKey: "scanZoom"); self.setZoom(stored > 0 ? stored : 2)
                    DispatchQueue.main.async { [weak self] in
                        guard let self else { return }
                        if let c = self.preview.previewLayer.connection, c.isVideoRotationAngleSupported(90) { c.videoRotationAngle = 90 }
                        let distance = device.minimumFocusDistance
                        self.hint.text = distance > 0 ? "手機保持約 \(Int(ceil(Double(distance)/10))) cm 或更遠，用 2× 取景。" : "拉遠手機，用 2× 取景；點按卡片對焦。"
                    }
                }
                if self.gate.liveToken() != nil && !self.session.isRunning { self.session.startRunning() }
            } catch { DispatchQueue.main.async { [weak self] in self?.status.text = "無法開啟鏡頭，請改用相片辨識。" } }
        }
    }
    @objc private func tapped(_ tap: UITapGestureRecognizer) { focus(preview.previewLayer.captureDevicePointConverted(fromLayerPoint: tap.location(in: preview))) }
    @objc private func refocus() { focus(CGPoint(x: 0.5, y: 0.5)) }
    private func focus(_ point: CGPoint) {
        guard !photoMode else { return }; lastFocus = CACurrentMediaTime(); hint.text = "正在重新對焦；拉遠手機，稍微轉動避開反光。"
        gate.change()
        cameraQueue.async { [weak self] in
            guard let device = self?.device else { return }
            do {
                try device.lockForConfiguration(); defer { device.unlockForConfiguration() }
                if device.isFocusPointOfInterestSupported { device.focusPointOfInterest = point }
                if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
                if device.isExposurePointOfInterestSupported { device.exposurePointOfInterest = point }
                if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
            } catch { }
        }
    }
    @objc private func one() { changeZoom(1) }
    @objc private func two() { changeZoom(2) }
    @objc private func slid() { changeZoom(slider.value) }
    private func changeZoom(_ zoom: Float) { gate.change(); cameraQueue.async { [weak self] in self?.setZoom(zoom) } }
    private func setZoom(_ zoom: Float) {
        guard let device else { return }
        let maximum = min(4, Float(device.maxAvailableVideoZoomFactor)), value = max(1, min(maximum, zoom))
        do { try device.lockForConfiguration(); device.videoZoomFactor = CGFloat(value); device.unlockForConfiguration(); UserDefaults.standard.set(value, forKey: "scanZoom") } catch { return }
        DispatchQueue.main.async { [weak self] in self?.slider.maximumValue = maximum; self?.slider.value = value; self?.zoomLabel.text = String(format: "%.1f×", value) }
    }
    @objc private func torch() {
        cameraQueue.async { [weak self] in
            guard let device = self?.device, device.hasTorch else { return }
            do { try device.lockForConfiguration(); defer { device.unlockForConfiguration() }; if device.torchMode == .on { device.torchMode = .off } else { try device.setTorchModeOn(level: 0.3) } } catch { }
        }
    }
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let token = gate.liveToken(), catalogue != nil, let pixels = CMSampleBufferGetImageBuffer(sampleBuffer), CACurrentMediaTime()-lastFrameAt > 0.10 else { return }
        lastFrameAt = CACurrentMediaTime()
        autoreleasepool {
            let frame = CIImage(cvPixelBuffer: pixels), rect = ScanGeometry.crop(frame: frame.extent.size, preview: gate.previewSize())
            guard let cg = context.createCGImage(frame, from: rect) else { return }
            process(UIImage(cgImage: cg), token: token, isPhoto: false)
        }
    }
    private func process(_ original: UIImage, token: Int, isPhoto: Bool) {
        guard gate.valid(token), let catalogue else { return }
        if token != lastToken { previous = nil; streak = 0; lastToken = token }
        let prepared = vision?.prepare(original) ?? ["image": original, "sharpness": 100.0]
        let image = (prepared["image"] as? UIImage) ?? original
        if !isPhoto && ((prepared["sharpness"] as? Double) ?? 0) < 28 {
            previous = nil; streak = 0
            DispatchQueue.main.async { [weak self] in guard let self, self.gate.valid(token) else { return }; self.status.text = "畫面有啲模糊，拉遠手機再對焦。"; if CACurrentMediaTime()-self.lastFocus > 3.5 { self.refocus() } }
            return
        }
        var visuals = vision?.match(image, textNumbers: []) ?? []
        var result = catalogue.combine(ScanResult(), visuals: visuals)
        if result.automatic == nil, let cg = image.cgImage {
            let request = VNRecognizeTextRequest(); request.recognitionLevel = .accurate; request.usesLanguageCorrection = true; request.minimumTextHeight = 0.008
            if let supported = try? request.supportedRecognitionLanguages() { request.recognitionLanguages = ["ja-JP", "en-US"].filter(supported.contains) }
            do {
                try VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:]).perform([request])
                let raw = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
                let text = catalogue.match(raw)
                if !text.hits.isEmpty { visuals = vision?.match(image, textNumbers: text.hits.prefix(5).map(\.number)) ?? visuals }
                result = catalogue.combine(text, visuals: visuals)
            } catch { /* Image evidence and manual candidates remain available. */ }
        }
        guard gate.valid(token) else { return }
        let now = CACurrentMediaTime()
        if let number = result.automatic { streak = previous == number && now-lastResultAt < 2.5 ? streak+1 : 1; previous = number; lastResultAt = now } else { previous = nil; streak = 0 }
        let pickedNumber = isPhoto || streak >= 2 ? result.automatic : nil
        let hits = result.hits
        DispatchQueue.main.async { [weak self] in
            guard let self, self.gate.valid(token) else { return }
            if let number = pickedNumber { self.finish(number); return }
            self.status.text = hits.isEmpty ? "未能確認，請保持距離並避開反光。" : "請保持穩定，或點選候選卡片"
            self.candidates.arrangedSubviews.forEach { self.candidates.removeArrangedSubview($0); $0.removeFromSuperview() }
            for hit in hits {
                guard let card = catalogue.byNumber[hit.number] else { continue }
                let button = UIButton(type: .system); button.setTitle("\(card.name) · \(card.number)\n\(hit.evidence)", for: .normal); button.titleLabel?.numberOfLines = 2; button.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium); button.setTitleColor(self.green, for: .normal); button.contentHorizontalAlignment = .leading
                button.heightAnchor.constraint(greaterThanOrEqualToConstant: 54).isActive = true
                button.addAction(UIAction { [weak self] _ in self?.finish(hit.number) }, for: .touchUpInside); self.candidates.addArrangedSubview(button)
            }
        }
    }
    @objc private func photos() {
        guard toolsReady else { return }; photoMode = true; gate.change(photo: true); cameraQueue.async { [weak self] in self?.session.stopRunning() }
        var config = PHPickerConfiguration(photoLibrary: .shared()); config.filter = .images; config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config); picker.delegate = self; present(picker, animated: true)
    }
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        // Wait for viewDidAppear before issuing a new ticket; dismissal must not invalidate the photo job.
        picker.dismiss(animated: true) { [weak self] in self?.readPhoto(results.first?.itemProvider) }
    }
    private func readPhoto(_ selected: NSItemProvider?) {
        guard let provider = selected else { live(); return }
        let token = gate.change(active: true, photo: true); photoMode = true; guide.isHidden = true; photoView.isHidden = false; status.text = "正在讀取相片…"
        provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] url, _ in
            guard let self, let url, let source = CGImageSourceCreateWithURL(url as CFURL, nil), let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1600] as CFDictionary) else {
                DispatchQueue.main.async { [weak self] in self?.status.text = "無法讀取相片，請試另一張。" }; return
            }
            let image = UIImage(cgImage: cg)
            DispatchQueue.main.async { [weak self] in guard let self, self.gate.valid(token) else { return }; self.photoView.image = image }
            self.analysisQueue.async { [weak self] in self?.process(image, token: token, isPhoto: true) }
        }
    }
    @objc private func live() { photoMode = false; photoView.isHidden = true; photoView.image = nil; guide.isHidden = false; gate.change(active: true, photo: false); requestCamera() }
    @objc private func close() { finish(nil) }
    private func finish(_ number: String?) { guard !picked else { return }; picked = true; pause(); onPick?(number) }
    deinit { NotificationCenter.default.removeObserver(self) }
}
