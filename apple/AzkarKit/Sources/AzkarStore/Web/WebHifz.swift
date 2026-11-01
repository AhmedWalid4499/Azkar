import AzkarCore
import Foundation

/// The memorisation log in a backup (`azkar:hifz`), in the shape of the website's stores though the
/// website has no such store: `entries` of `{ id, sura, day, at, kind }`, times in milliseconds.
/// What cannot be read is skipped, one entry at a time.
enum WebHifz {
    static let version = 1

    static func read(_ value: JSONValue?) -> [HifzEntry] {
        var entries: [UUID: HifzEntry] = [:]
        for stored in value?["entries"]?.array ?? [] {
            if let entry = entry(stored), entries[entry.id] == nil { entries[entry.id] = entry }
        }
        return entries.values.sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }

    private static func entry(_ stored: JSONValue) -> HifzEntry? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let sura = WebRules.whole(stored["sura"], max: Double(HifzProgress.suraCount)), sura >= 1,
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"]),
              let kind = stored["kind"]?.string.flatMap(HifzEntry.Kind.init(rawValue:))
        else { return nil }
        return HifzEntry(id: id, sura: sura, day: day, at: at, kind: kind)
    }

    static func web(_ entries: [HifzEntry]) -> JSONValue {
        ["entries": .array(entries.map { entry -> JSONValue in
            [
                "id": .string(entry.id.uuidString), "sura": JSONValue(entry.sura), "day": .string(entry.day.description),
                "at": JSONValue(ms: entry.at), "kind": .string(entry.kind.rawValue),
            ]
        })]
    }
}
