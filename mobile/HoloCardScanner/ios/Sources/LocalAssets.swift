import Foundation
import WebKit
import CryptoKit
import ImageIO

/// Only bundled files and official original card images are served under the local origin.
final class LocalAssets: NSObject, WKURLSchemeHandler {
    private let queue = OperationQueue()
    private let fileQueue = OperationQueue()
    private var cancelled = Set<ObjectIdentifier>()
    private let lock = NSLock()
    private let imageCache = OriginalArtCache()
    override init() { super.init(); queue.maxConcurrentOperationCount = 4; fileQueue.maxConcurrentOperationCount = 2 }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task as AnyObject)
        lock.lock(); cancelled.remove(id); lock.unlock()
        let worker = task.request.url?.path == "/original-art" ? queue : fileQueue
        worker.addOperation { [self] in
            guard let url = task.request.url, url.scheme == "holo", url.host == "localhost", !url.path.contains("..") else { fail(task, id); return }
            var data: Data?, mime = "text/plain"
            if url.path == "/original-art", let raw = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "url" })?.value {
                if let image = imageCache.load(raw) { data = image.0; mime = image.1 }
            } else {
                let path = ["/", "/account"].contains(url.path) ? "app/index.html" : String(url.path.dropFirst())
                let allowed = path.hasPrefix("app/") || ["cards.json", "scanner-ja.json", "holosim-card-index.json", "art-map.json"].contains(path) || path.range(of: #"^card-art/[a-f0-9]{20}\.webp$"#, options: .regularExpression) != nil
                if allowed { data = try? Data(contentsOf: CardCatalogue.assets.appendingPathComponent(path)); mime = Self.mime(path) }
            }
            guard let data else { fail(task, id); return }
            DispatchQueue.main.async { [self] in
                guard !isCancelled(id) else { return }
                task.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: mime.hasPrefix("text/") || mime == "application/json" ? "utf-8" : nil))
                task.didReceive(data); task.didFinish()
            }
        }
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) { lock.lock(); cancelled.insert(ObjectIdentifier(task as AnyObject)); lock.unlock() }
    private func isCancelled(_ id: ObjectIdentifier) -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled.contains(id) }
    private func fail(_ task: WKURLSchemeTask, _ id: ObjectIdentifier) { DispatchQueue.main.async { [self] in if !isCancelled(id) { task.didFailWithError(URLError(.fileDoesNotExist)) } } }
    private static func mime(_ path: String) -> String {
        switch (path as NSString).pathExtension { case "js": return "text/javascript"; case "css": return "text/css"; case "json": return "application/json"; case "webp": return "image/webp"; default: return "text/html" }
    }
}

private final class ArtRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(OriginalArtCache.allowed(request.url) ? request : nil)
    }
}
final class OriginalArtCache {
    private let directory: URL
    private let session: URLSession
    private let fileLock = NSLock()
    private let thumbnails: [String: String]
    init() {
        directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("original-card-art-v1", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let config = URLSessionConfiguration.ephemeral; config.timeoutIntervalForRequest = 10; config.timeoutIntervalForResource = 15
        session = URLSession(configuration: config, delegate: ArtRedirects(), delegateQueue: nil)
        thumbnails = ((try? Data(contentsOf: CardCatalogue.assets.appendingPathComponent("art-map.json"))).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }) ?? [:]
    }
    static func allowed(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == "hololive-official-cardgame.com" && url.user == nil && url.password == nil && (url.port == nil || url.port == 443) && url.path.hasPrefix("/wp-content/images/cardlist/") && !url.path.contains("..")
    }
    func load(_ raw: String) -> (Data, String)? {
        guard let url = URL(string: raw), Self.allowed(url) else { return nil }
        let name = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined() + ".image"
        let file = directory.appendingPathComponent(name)
        if let data = try? Data(contentsOf: file), let mime = Self.imageMime(data) {
            try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
            return (data, mime)
        }
        // Runs on the bounded asset queue, never on the main/camera queue.
        let ready = DispatchSemaphore(value: 0), result = ArtResponse()
        let task = session.dataTask(with: url) { data, response, _ in
            if let response = response as? HTTPURLResponse, response.statusCode == 200, let data, data.count <= 8 * 1024 * 1024, let mime = Self.imageMime(data) { result.value = (data, mime) }
            ready.signal()
        }
        task.resume()
        if ready.wait(timeout: .now() + 16) == .timedOut { task.cancel() }
        if let value = result.value {
            try? value.0.write(to: file, options: .atomic); trim()
            return value
        }
        if let path = thumbnails[raw], let data = try? Data(contentsOf: CardCatalogue.assets.appendingPathComponent(String(path.dropFirst()))) { return (data, "image/webp") }
        return nil
    }
    private static func imageMime(_ data: Data) -> String? {
        guard data.count <= 8 * 1024 * 1024, let source = CGImageSourceCreateWithData(data as CFData, nil), let p = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any], let w = p[kCGImagePropertyPixelWidth] as? Int, let h = p[kCGImagePropertyPixelHeight] as? Int, w > 0, h > 0, w <= 8192, h <= 8192 else { return nil }
        let type = CGImageSourceGetType(source) as String? ?? ""
        if type.contains("png") { return "image/png" }; if type.contains("webp") { return "image/webp" }; if type.contains("jpeg") { return "image/jpeg" }; return "image/heic"
    }
    private func trim() {
        fileLock.lock(); defer { fileLock.unlock() }
        let files = ((try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey])) ?? []).filter { $0.pathExtension == "image" }
        let sorted = files.compactMap { f -> (URL, Int, Date)? in guard let v = try? f.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey]) else { return nil }; return (f, v.fileSize ?? 0, v.contentModificationDate ?? .distantPast) }.sorted { $0.2 < $1.2 }
        var size = sorted.reduce(0) { $0 + $1.1 }
        for (f, bytes, _) in sorted { if size <= 160 * 1024 * 1024 { break }; if (try? FileManager.default.removeItem(at: f)) != nil { size -= bytes } }
    }
}
private final class ArtResponse {
    private let lock = NSLock(); private var stored: (Data, String)?
    var value: (Data, String)? { get { lock.lock(); defer { lock.unlock() }; return stored } set { lock.lock(); stored = newValue; lock.unlock() } }
}
