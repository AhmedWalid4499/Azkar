import AzkarCore
import Foundation

/// The website's prayer log (`azkar:prayer-log`, src/features/prayer-log/sanitize.ts):
/// version 1 kept `entries` only; version 2 adds `loggedAt` (beside a status only) and `sunnah`.
/// Days after today are kept: a trip across the date line can put a real entry there.
enum WebPrayerLog {
    static let version = 2

    /// `sanitizeLog`: known prayers and statuses on real days; change times only beside a status.
    static func read(_ value: JSONValue?) -> [DayKey: DayPrayerRecord] {
        let entries = WebRules.dated(value?["entries"]) { stored -> [Prayer: PrayerStatus]? in
            guard let object = stored.object else { return nil }
            var day: [Prayer: PrayerStatus] = [:]
            for prayer in Prayer.allCases {
                if let raw = object[prayer.rawValue]?.string, let status = PrayerStatus(rawValue: raw) { day[prayer] = status }
            }
            return day.isEmpty ? nil : day
        }
        let stamps = value?["loggedAt"]?.object ?? [:]
        var out: [DayKey: DayPrayerRecord] = [:]
        for (day, statuses) in entries {
            let stamped = stamps[day.description]?.object ?? [:]
            var record = DayPrayerRecord()
            for (prayer, status) in statuses {
                record.prayers[prayer] = PrayerEntry(status: status, loggedAt: WebRules.timestamp(stamped[prayer.rawValue]))
            }
            out[day] = record
        }
        let sunnah = WebRules.dated(value?["sunnah"]) { stored -> [SunnahPrayer: Date]? in
            guard let object = stored.object else { return nil }
            var day: [SunnahPrayer: Date] = [:]
            for prayer in SunnahPrayer.allCases {
                if let at = WebRules.timestamp(object[prayer.rawValue]) { day[prayer] = at }
            }
            return day.isEmpty ? nil : day
        }
        for (day, ticked) in sunnah { out[day, default: DayPrayerRecord()].sunnah = ticked }
        return out
    }

    /// The state the website's store saves.
    static func web(_ days: [DayKey: DayPrayerRecord]) -> JSONValue {
        var entries: [String: JSONValue] = [:]
        var loggedAt: [String: JSONValue] = [:]
        var sunnah: [String: JSONValue] = [:]
        for (day, record) in days {
            let key = day.description
            if !record.prayers.isEmpty {
                entries[key] = .object(Dictionary(uniqueKeysWithValues: record.prayers.map { ($0.key.rawValue, JSONValue.string($0.value.status.rawValue)) }))
                let stamps = record.prayers.compactMapValues(\.loggedAt)
                if !stamps.isEmpty {
                    loggedAt[key] = .object(Dictionary(uniqueKeysWithValues: stamps.map { ($0.key.rawValue, JSONValue(ms: $0.value)) }))
                }
            }
            if !record.sunnah.isEmpty {
                sunnah[key] = .object(Dictionary(uniqueKeysWithValues: record.sunnah.map { ($0.key.rawValue, JSONValue(ms: $0.value)) }))
            }
        }
        return ["entries": .object(entries), "loggedAt": .object(loggedAt), "sunnah": .object(sunnah)]
    }
}

/// The fasting log of the website's WIP branch (`azkar:fasting`, src/features/fasting/sanitize.ts):
/// `days` of `{ kind, status, at? }` and `owedBefore`.
enum WebFasting {
    static let version = 1

    static func read(_ value: JSONValue?) -> (fasts: [DayKey: FastRecord], owedBefore: Int) {
        let state = value?.object ?? [:]
        let fasts = WebRules.dated(state["days"]) { stored -> FastRecord? in
            guard let object = stored.object,
                  let kind = object["kind"]?.string.flatMap(FastKind.init(rawValue:)),
                  let status = object["status"]?.string.flatMap(FastStatus.init(rawValue:))
            else { return nil }
            return FastRecord(kind: kind, status: status, loggedAt: WebRules.timestamp(object["at"]))
        }
        var owed = 0
        if let number = state["owedBefore"]?.number, WebRules.isInteger(number) {
            owed = Int(min(Double(RecordLimits.maxOwedFastsBefore), max(0, number)))
        }
        return (fasts, owed)
    }

    static func web(_ fasts: [DayKey: FastRecord], owedBefore: Int) -> JSONValue {
        var days: [String: JSONValue] = [:]
        for (day, fast) in fasts {
            var record: [String: JSONValue] = ["kind": .string(fast.kind.rawValue), "status": .string(fast.status.rawValue)]
            if let at = fast.loggedAt { record["at"] = JSONValue(ms: at) }
            days[day.description] = .object(record)
        }
        return ["days": .object(days), "owedBefore": JSONValue(owedBefore)]
    }
}
