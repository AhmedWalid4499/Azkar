import AzkarCore
import Foundation

/// The hadith of the day read, in a backup (`azkar:hadith`), in the shape of the website's stores
/// though the website has no such store: `read` of `{ day, number }`. What cannot be read is
/// skipped, one entry at a time; a day given twice keeps its first entry.
enum WebHadith {
    static let version = 1

    static func read(_ value: JSONValue?) -> [DayKey: Int] {
        var read: [DayKey: Int] = [:]
        for stored in value?.object?["read"]?.array ?? [] {
            guard let day = stored["day"]?.string.flatMap(WebRules.day), read[day] == nil,
                  let number = WebRules.whole(stored["number"], max: 1_000_000), number > 0 else { continue }
            read[day] = number
        }
        return read
    }

    static func web(_ read: [DayKey: Int]) -> JSONValue {
        let entries = read.sorted { $0.key < $1.key }.map { day, number -> JSONValue in
            ["day": .string(day.description), "number": JSONValue(number)]
        }
        return ["read": .array(entries)]
    }
}
