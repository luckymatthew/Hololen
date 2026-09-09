import UIKit
import WebKit
import UniformTypeIdentifiers

final class WebAppViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply, UIDocumentPickerDelegate {
    private let origin = "https://hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site"
    private var web: WKWebView!
    private let localAssets = LocalAssets()
    private let cloud = URLSession(configuration: .default)
    private var exportURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = UIColor(red: 13/255, green: 20/255, blue: 18/255, alpha: 1)
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(localAssets, forURLScheme: "holo")
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.userContentController.add(self, name: "native")
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "cloud")
        if let url = Bundle.main.url(forResource: "bridge", withExtension: "js"), let js = try? String(contentsOf: url, encoding: .utf8) { config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        web = WKWebView(frame: .zero, configuration: config); web.navigationDelegate = self; web.uiDelegate = self
        web.isOpaque = false; web.backgroundColor = view.backgroundColor; web.scrollView.contentInsetAdjustmentBehavior = .never
        web.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(web)
        NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor), web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)])
        web.load(URLRequest(url: URL(string: "holo://localhost/app/index.html")!))
    }
    private func trusted(_ message: WKScriptMessage) -> Bool {
        message.frameInfo.isMainFrame && message.frameInfo.securityOrigin.protocol == "holo" && message.frameInfo.securityOrigin.host == "localhost"
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard trusted(message), let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "scan":
            guard presentedViewController == nil else { return }
            let scanner = ScannerViewController(); scanner.modalPresentationStyle = .fullScreen
            scanner.onPick = { [weak self] number in self?.dismiss(animated: true) { self?.emit("native-scan", number.map { ["number": $0] } ?? [:]) } }
            present(scanner, animated: true)
        case "import":
            guard presentedViewController == nil else { return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json, .plainText, .data], asCopy: true); picker.delegate = self; picker.allowsMultipleSelection = false; present(picker, animated: true)
        case "export":
            guard presentedViewController == nil, exportURL == nil, let json = body["json"] as? String, json.utf8.count <= 2_000_000, let data = json.data(using: .utf8), (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else { return }
            let name = String(((body["name"] as? String) ?? "holodeck.json").prefix(120)).replacingOccurrences(of: #"[^\p{L}\p{N} ._-]"#, with: "_", options: .regularExpression)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                let file = url.appendingPathComponent(name.hasSuffix(".json") ? name : name + ".json"); try data.write(to: file)
                exportURL = file; let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true); picker.delegate = self; present(picker, animated: true)
            } catch { emit("native-export", ["ok": false]) }
        case "external":
            if let raw = body["url"] as? String, let url = URL(string: raw), url.scheme == "https", url.host == "hololive-official-cardgame.com" { UIApplication.shared.open(url) }
        default: break
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard trusted(message), let body = message.body as? [String: Any], let path = body["path"] as? String, let method = body["method"] as? String, let json = body["body"] as? String, json.utf8.count <= 2_000_000, ["GET", "POST", "PUT", "DELETE"].contains(method), Self.allowedAPI(path), let url = URL(string: origin + path) else { replyHandler(nil, "不支援的帳號要求"); return }
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(origin, forHTTPHeaderField: "Origin")
        if method != "GET" && !json.isEmpty { request.httpBody = Data(json.utf8) }
        cloud.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                guard error == nil, let response = response as? HTTPURLResponse, (200...599).contains(response.statusCode), let data, data.count <= 4_000_000 else { replyHandler(nil, "未能連接帳號服務，請稍後重試。"); return }
                replyHandler(["status": response.statusCode, "body": String(data: data, encoding: .utf8) ?? "{}"], nil)
            }
        }.resume()
    }
    static func allowedAPI(_ path: String) -> Bool {
        path.range(of: #"^/api/(auth/(session|login|register|logout)|decks(/[A-Za-z0-9_-]{1,100})?)$"#, options: .regularExpression) != nil
    }
    private func emit(_ name: String, _ data: [String: Any]) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: ["name": name, "detail": data]), let value = String(data: bytes, encoding: .utf8) else { return }
        web.evaluateJavaScript("(()=>{const event=\(value);window.dispatchEvent(new CustomEvent(event.name,{detail:event.detail}));})()", completionHandler: nil)
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if exportURL != nil { finishExport(true); return }
        guard let url = urls.first else { return }
        let scope = url.startAccessingSecurityScopedResource(); defer { if scope { url.stopAccessingSecurityScopedResource() } }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size <= 2_000_000 else { throw CocoaError(.fileReadTooLarge) }
            let data = try Data(contentsOf: url); guard data.count <= 2_000_000, let json = String(data: data, encoding: .utf8) else { throw CocoaError(.fileReadCorruptFile) }
            emit("native-import", ["name": url.lastPathComponent, "json": json])
        } catch { emit("native-import", ["error": "無法讀取；請選擇 2 MB 以內的牌組 JSON。"]) }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { if exportURL != nil { finishExport(false) } }
    private func finishExport(_ success: Bool) { if let url = exportURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }; exportURL = nil; emit("native-export", ["ok": success]) }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, navigationAction.targetFrame?.isMainFrame == true else { decisionHandler(.cancel); return }
        if url.scheme == "holo", url.host == "localhost", ["/", "/app/index.html", "/account"].contains(url.path) {
            if url.path != "/app/index.html" {
                var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!; components.path = "/app/index.html"
                if url.path == "/account" { components.fragment = "account" }
                decisionHandler(.cancel); if let canonical = components.url { webView.load(URLRequest(url: canonical)) }; return
            }
            decisionHandler(.allow); return
        }
        if url.scheme == "https", url.host == "hololive-official-cardgame.com" { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert); alert.addAction(UIAlertAction(title: "知道了", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert); alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) }); alert.addAction(UIAlertAction(title: "確認", style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
}
