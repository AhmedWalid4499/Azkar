import AzkarCore
import Foundation

/// The season records in a backup (`azkar:seasons`), in the shape of the website's stores though
/// the website has no such store: `records` of `{ deed, day, at, place, rakahs }`, the time in
/// milliseconds, `place` and `rakahs` left out when not given. What cannot be read is skipped, one
/// record at a time, as the website's stores read theirs.
enum WebSeasons {
    static let version = 1

    static func read(_ value: JSONValue?) -> [DayKey: [SeasonDeed: SeasonRecord]] {
        var seasons: [DayKey: [SeasonDeed: SeasonRecord]] = [:]
        for stored in value?.object?["records"]?.array ?? [] {
            guard let record = record(stored), seasons[record.day]?[record.deed] == nil else { continue }
            seasons[record.day, default: [:]][record.deed] = record
        }
        return seasons
    }

    private static func record(_ stored: JSONValue) -> SeasonRecord? {
        guard let deed = stored["deed"]?.string.flatMap(SeasonDeed.init(rawValue:)),
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"]) else { return nil }
        var record = SeasonRecord(deed: deed, day: day, at: at)
        if let place = stored["place"], place != .null {
            guard let known = place.string.flatMap(WorshipPlace.init(rawValue:)) else { return nil }
            record.place = known
        }
        if let rakahs = stored["rakahs"], rakahs != .null {
            guard let count = WebRules.whole(rakahs, max: Double(SeasonRecord.rakahsRange.upperBound)),
                  SeasonRecord.rakahsRange.contains(count) else { return nil }
            record.rakahs = count
        }
        return record
    }

    static func web(_ seasons: [DayKey: [SeasonDeed: SeasonRecord]]) -> JSONValue {
        let records = seasons.values.flatMap(\.values).sorted { ($0.day, $0.deed.rawValue) < ($1.day, $1.deed.rawValue) }
        let written = records.map { record -> JSONValue in
            var fields: [String: JSONValue] = [
                "deed": .string(record.deed.rawValue), "day": .string(record.day.description), "at": JSONValue(ms: record.at),
            ]
            if let place = record.place { fields["place"] = .string(place.rawValue) }
            if let rakahs = record.rakahs { fields["rakahs"] = JSONValue(rakahs) }
            return .object(fields)
        }
        return ["records": .array(written)]
    }
}
