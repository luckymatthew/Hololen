import Foundation

struct CardRecord {
    let number, name, stage, type: String
    let hp: Int
    var names = Set<String>(), titles = Set<String>(), effects = Set<String>()
}
struct ScanHit {
    let number: String
    var score: Double = 0
    var exactCode = false, strongText = false, conflict = false
    var evidence = ""
}
struct ScanResult {
    var hits: [ScanHit] = []
    var automatic: String?
}

/// Same Japanese skill data and conservative evidence policy as the Android app.
final class CardCatalogue {
    private(set) var cards: [CardRecord] = []
    private(set) var byNumber: [String: CardRecord] = [:]
    private var titleFrequency: [String: Int] = [:], effectFrequency: [String: Int] = [:]
    static var assets: URL { Bundle.main.resourceURL!.appendingPathComponent("assets", isDirectory: true) }

    init(assets: URL = CardCatalogue.assets) throws {
        let root = (try JSONSerialization.jsonObject(with: Data(contentsOf: assets.appendingPathComponent("cards.json"))) as? [String: Any]) ?? [:]
        let japanese = (try JSONSerialization.jsonObject(with: Data(contentsOf: assets.appendingPathComponent("scanner-ja.json"))) as? [String: Any]) ?? [:]
        let jaCards = (japanese["cards"] as? [String: [String: Any]]) ?? [:]
        for j in (root["cards"] as? [[String: Any]]) ?? [] where (j["simOnly"] as? Bool) != true {
            guard let number = j["number"] as? String, let name = j["name"] as? String else { continue }
            var card = CardRecord(number: number, name: name, stage: (j["stage"] as? String) ?? "", type: (j["type"] as? String) ?? "", hp: (j["hp"] as? Int) ?? 0)
            for key in ["name", "jpName", "enName"] { if let s = j[key] as? String, !s.isEmpty { card.names.insert(Self.normalize(s)) } }
            var skills = (j["arts"] as? [[String: Any]]) ?? []
            for key in ["keyword", "stageSkill", "oshiSkill", "spOshiSkill"] { if let s = j[key] as? [String: Any] { skills.append(s) } }
            for s in skills {
                let title = Self.normalize((s["name"] as? String) ?? "")
                if title.count >= 3 { card.titles.insert(title) }
                card.effects.formUnion(Self.grams(Self.normalize((s["effect"] as? String) ?? ""), 5))
            }
            card.effects.formUnion(Self.grams(Self.normalize((j["abilityText"] as? String) ?? ""), 5))
            for s in (jaCards[number]?["titles"] as? [String]) ?? [] { let t = Self.normalize(s); if t.count >= 3 { card.titles.insert(t) } }
            for s in (jaCards[number]?["effects"] as? [String]) ?? [] { card.effects.formUnion(Self.grams(Self.normalize(s), 5)) }
            for title in card.titles { titleFrequency[title, default: 0] += 1 }
            for effect in card.effects { effectFrequency[effect, default: 0] += 1 }
            cards.append(card); byNumber[number] = card
        }
    }
    static func normalize(_ raw: String) -> String {
        let s = raw.precomposedStringWithCompatibilityMapping.lowercased()
        return String(String.UnicodeScalarView(s.unicodeScalars.compactMap { scalar in
            let value = scalar.value
            let c = (0x30a1...0x30f6).contains(value) ? UnicodeScalar(value - 0x60)! : scalar
            return CharacterSet.alphanumerics.contains(c) ? c : nil
        }))
    }
    private static func grams(_ s: String, _ n: Int) -> Set<String> {
        let chars = Array(s); guard chars.count >= n else { return [] }
        return Set((0...(chars.count-n)).map { String(chars[$0..<($0+n)]) })
    }
    private static func matches(_ pattern: String, _ raw: String, group: Int = 0) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return [] }
        let ns = raw as NSString
        return regex.matches(in: raw, range: NSRange(location: 0, length: ns.length)).compactMap { m in
            let range = m.range(at: group); return range.location == NSNotFound ? nil : ns.substring(with: range)
        }
    }
    func match(_ input: String) -> ScanResult {
        let raw = String(input.prefix(12000)).precomposedStringWithCompatibilityMapping
        let text = Self.normalize(raw)
        let codes = Set(Self.matches(#"h\s*(?:bp|bd|sd|eb|pr|ys|y)\s*\d{0,2}\s*[-‐‑–—ー]?\s*\d{3}(?!\d)"#, raw).map(Self.normalize))
        let hp = Int(Self.matches(#"hp\s*[:：]?\s*(\d{2,3})"#, raw, group: 1).first ?? "") ?? 0
        let stage = Self.matches(#"\b(debut|1st|2nd|spot)\b"#, raw, group: 1).first?.lowercased() ?? ""
        let titleGrams = Self.grams(text, 3), effectGrams = Self.grams(text, 5).intersection(effectFrequency.keys)
        var hits: [ScanHit] = []
        for card in cards {
            var h = ScanHit(number: card.number)
            h.exactCode = codes.contains(Self.normalize(card.number))
            if h.exactCode { h.score = 200; h.evidence = "卡號相符" }
            let name = card.names.contains { $0.count >= 3 && text.contains($0) }
            if name { h.score += 25; if h.evidence.isEmpty { h.evidence = "卡名相符" } }
            var titleScore = 0, unique = false
            for title in card.titles {
                if text.contains(title) {
                    let single = titleFrequency[title] == 1
                    unique = unique || (single && title.count >= 5)
                    titleScore = max(titleScore, single ? 65 : 40)
                } else if title.count >= 6 {
                    let g = Self.grams(title, 3)
                    let ratio = Double(g.intersection(titleGrams).count) / Double(max(1, g.count))
                    if !g.isEmpty && ratio >= 0.6 { titleScore = max(titleScore, Int((ratio * 35).rounded())) }
                }
            }
            if titleScore > 0 { h.score += Double(titleScore); if !h.exactCode { h.evidence = "技能文字" } }
            var weight = 0.0, overlap = 0
            for e in effectGrams where card.effects.contains(e) { overlap += 1; weight += log(1 + Double(cards.count) / Double(effectFrequency[e] ?? 1)) }
            if overlap >= 3 && weight >= 8 { h.score += min(45, (weight / 3).rounded()); if h.evidence.isEmpty { h.evidence = "效果片段" } }
            if h.score == 0 { continue }
            if hp > 0 && card.hp > 0 { h.score += hp == card.hp ? 12 : -20; h.conflict = hp != card.hp }
            if !stage.isEmpty && !card.stage.isEmpty { h.score += stage == card.stage.lowercased() ? 8 : -15; h.conflict = h.conflict || stage != card.stage.lowercased() }
            h.strongText = unique && name && !h.conflict
            if h.score > 0 { hits.append(h) }
        }
        hits.sort { $0.score == $1.score ? $0.number < $1.number : $0.score > $1.score }
        var automatic: String?
        if let best = hits.first {
            let next = hits.dropFirst().first
            if (best.exactCode && codes.count == 1 && next?.exactCode != true) || (codes.isEmpty && best.strongText && best.score >= 90 && best.score - (next?.score ?? 0) >= 30) { automatic = best.number }
        }
        return ScanResult(hits: Array(hits.prefix(12)), automatic: automatic)
    }

    func combine(_ text: ScanResult, visuals: [[String: Any]]) -> ScanResult {
        var byNumber = Dictionary(uniqueKeysWithValues: text.hits.map { ($0.number, $0) })
        for v in visuals {
            guard let number = v["number"] as? String else { continue }
            var hit = byNumber[number] ?? ScanHit(number: number)
            hit.score += min(160, 50 + Double((v["inliers"] as? Int) ?? 0) * 3)
            hit.evidence += hit.evidence.isEmpty ? "卡圖幾何相符" : " ＋ 卡圖"
            byNumber[number] = hit
        }
        var automatic = text.automatic
        if let best = visuals.first, let number = best["number"] as? String, best["strong"] as? Bool == true {
            let inliers = (best["inliers"] as? Int) ?? 0, next = (visuals.dropFirst().first?["inliers"] as? Int) ?? 0
            if inliers - next >= 7 {
                if let old = automatic, old != number { automatic = nil }
                else if !text.hits.contains(where: { $0.exactCode && $0.number != number }) { automatic = number }
            }
        }
        let ranked = byNumber.values.sorted { $0.score == $1.score ? $0.number < $1.number : $0.score > $1.score }
        return ScanResult(hits: Array(ranked.prefix(5)), automatic: automatic)
    }
}
