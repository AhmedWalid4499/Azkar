import AzkarCore
import Foundation

/// The Quran log in a backup (`azkar:quran`), in the shape of the website's stores though the
/// website has no such store: `entries` of `{ id, day, at, kind, fromPage, toPage }` and
/// `bookmarks` of page to time, times in milliseconds. What cannot be read is skipped, one
/// entry at a time, as the website's stores read theirs.
enum WebQuran {
    static let version = 1

    static func read(_ value: JSONValue?) -> (entries: [QuranEntry], bookmarks: [Int: Date]) {
        let state = value?.object ?? [:]
        var entries: [UUID: QuranEntry] = [:]
        for stored in state["entries"]?.array ?? [] {
            if let entry = entry(stored), entries[entry.id] == nil { entries[entry.id] = entry }
        }
        var bookmarks: [Int: Date] = [:]
        for (key, stored) in state["bookmarks"]?.object ?? [:] {
            guard let page = Int(key), (1...QuranProgress.pageCount).contains(page), let at = WebRules.timestamp(stored) else { continue }
            bookmarks[page] = at
        }
        return (Array(entries.values).inLogOrder, bookmarks)
    }

    private static func entry(_ stored: JSONValue) -> QuranEntry? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"]),
              let kind = stored["kind"]?.string.flatMap(QuranEntry.Kind.init(rawValue:)),
              let fromPage = WebRules.whole(stored["fromPage"], max: Double(QuranProgress.pageCount - 1)),
              let toPage = WebRules.whole(stored["toPage"], max: Double(QuranProgress.pageCount)),
              kind == .khatmah ? toPage == 0 : toPage > 0
        else { return nil }
        return QuranEntry(id: id, day: day, at: at, kind: kind, fromPage: fromPage, toPage: toPage)
    }

    static func web(_ entries: [QuranEntry], bookmarks: [Int: Date]) -> JSONValue {
        let written = entries.map { entry -> JSONValue in
            [
                "id": .string(entry.id.uuidString), "day": .string(entry.day.description), "at": JSONValue(ms: entry.at),
                "kind": .string(entry.kind.rawValue), "fromPage": JSONValue(entry.fromPage), "toPage": JSONValue(entry.toPage),
            ]
        }
        let pages = Dictionary(uniqueKeysWithValues: bookmarks.map { (String($0.key), JSONValue(ms: $0.value)) })
        return ["entries": .array(written), "bookmarks": .object(pages)]
    }
}
