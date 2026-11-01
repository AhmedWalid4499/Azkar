import AzkarCore
import Foundation

// The native app's own logs in a backup, in the shape of the website's stores though the website
// has none of them. Times are in milliseconds; what cannot be read is skipped, one entry at a time.

/// Prayers made up from before the log began (`azkar:prayer-makeups`).
enum WebMakeups {
    static let version = 1

    static func read(_ value: JSONValue?) -> (makeups: [PrayerMakeup], owedBefore: [Prayer: Int]) {
        var owed: [Prayer: Int] = [:]
        for prayer in Prayer.allCases {
            if let count = WebRules.whole(value?["owedBefore"]?[prayer.rawValue], max: Double(RecordLimits.maxOwedPrayersBefore)), count > 0 {
                owed[prayer] = count
            }
        }
        var makeups: [UUID: PrayerMakeup] = [:]
        for stored in value?["entries"]?.array ?? [] {
            if let makeup = makeup(stored), makeups[makeup.id] == nil { makeups[makeup.id] = makeup }
        }
        return (makeups.values.sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }, owed)
    }

    private static func makeup(_ stored: JSONValue) -> PrayerMakeup? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let prayer = stored["prayer"]?.string.flatMap(Prayer.init(rawValue:)),
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"])
        else { return nil }
        return PrayerMakeup(id: id, prayer: prayer, day: day, at: at)
    }

    static func web(_ makeups: [PrayerMakeup], owedBefore: [Prayer: Int]) -> JSONValue {
        [
            "owedBefore": .object(Dictionary(uniqueKeysWithValues: owedBefore.map { ($0.key.rawValue, JSONValue($0.value)) })),
            "entries": .array(makeups.map { makeup -> JSONValue in
                ["id": .string(makeup.id.uuidString), "prayer": .string(makeup.prayer.rawValue), "day": .string(makeup.day.description), "at": JSONValue(ms: makeup.at)]
            }),
        ]
    }
}

/// What was given (`azkar:giving`). Amounts are kept as text, to the digit.
enum WebGiving {
    static let version = 1
    private static let posix = Locale(identifier: "en_US_POSIX")

    static func read(_ value: JSONValue?) -> [GivingEntry] {
        var entries: [UUID: GivingEntry] = [:]
        for stored in value?["entries"]?.array ?? [] {
            if let entry = entry(stored), entries[entry.id] == nil { entries[entry.id] = entry }
        }
        return entries.values.sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }

    private static func entry(_ stored: JSONValue) -> GivingEntry? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let kind = stored["kind"]?.string.flatMap(GivingEntry.Kind.init(rawValue:)),
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"])
        else { return nil }
        return GivingEntry(id: id, kind: kind, day: day, at: at, amount: stored["amount"]?.string.flatMap { Decimal(string: $0, locale: posix) },
                           currency: stored["currency"]?.string, note: stored["note"]?.string)
    }

    static func web(_ entries: [GivingEntry]) -> JSONValue {
        ["entries": .array(entries.map { entry -> JSONValue in
            var fields: [String: JSONValue] = [
                "id": .string(entry.id.uuidString), "kind": .string(entry.kind.rawValue), "day": .string(entry.day.description), "at": JSONValue(ms: entry.at),
            ]
            if let amount = entry.amount { fields["amount"] = .string("\(amount)") }
            if let currency = entry.currency { fields["currency"] = .string(currency) }
            if let note = entry.note { fields["note"] = .string(note) }
            return .object(fields)
        })]
    }
}

/// The user's duas and their log (`azkar:duas`).
enum WebDuas {
    static let version = 1

    static func read(_ value: JSONValue?) -> (items: [DuaItem], entries: [DuaEntry]) {
        var items: [UUID: DuaItem] = [:]
        for stored in value?["items"]?.array ?? [] {
            if let item = item(stored), items[item.id] == nil { items[item.id] = item }
        }
        var entries: [UUID: DuaEntry] = [:]
        for stored in value?["entries"]?.array ?? [] {
            if let entry = entry(stored), entries[entry.id] == nil { entries[entry.id] = entry }
        }
        return (items.values.sorted { ($0.addedAt, $0.id.uuidString) < ($1.addedAt, $1.id.uuidString) },
                entries.values.sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) })
    }

    private static func item(_ stored: JSONValue) -> DuaItem? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let text = stored["text"]?.string.flatMap(DuaItem.cleaned),
              let addedAt = WebRules.timestamp(stored["addedAt"])
        else { return nil }
        return DuaItem(id: id, text: text, addedAt: addedAt)
    }

    private static func entry(_ stored: JSONValue) -> DuaEntry? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let dua = stored["dua"]?.string.flatMap(UUID.init(uuidString:)),
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"]),
              let kind = stored["kind"]?.string.flatMap(DuaEntry.Kind.init(rawValue:))
        else { return nil }
        return DuaEntry(id: id, dua: dua, day: day, at: at, kind: kind)
    }

    static func web(_ items: [DuaItem], entries: [DuaEntry]) -> JSONValue {
        [
            "items": .array(items.map { item -> JSONValue in
                ["id": .string(item.id.uuidString), "text": .string(item.text), "addedAt": JSONValue(ms: item.addedAt)]
            }),
            "entries": .array(entries.map { entry -> JSONValue in
                [
                    "id": .string(entry.id.uuidString), "dua": .string(entry.dua.uuidString), "day": .string(entry.day.description),
                    "at": JSONValue(ms: entry.at), "kind": .string(entry.kind.rawValue),
                ]
            }),
        ]
    }
}
