import AzkarCore
import Foundation

/// The memorisation log and plans in a backup (`azkar:hifz`), in the shape of the website's stores
/// though the website has no such store: `entries` of `{ id, sura, day, at, kind }` with, since
/// version 2, `from` and `to` (the ayat, both or neither) and `strength` (1 to 3, on reviews), and
/// `plans` of `{ id, createdAt, start, target, targetDay, dailyAyat, endedAt? }`; times in
/// milliseconds. A version 1 backup reads the same way and holds whole surahs and no plans.
/// What cannot be read is skipped, one entry at a time.
enum WebHifz {
    static let version = 2

    struct Read: Hashable {
        var entries: [HifzEntry] = []
        var plans: [HifzPlan] = []
    }

    static func read(_ value: JSONValue?) -> Read {
        var entries: [UUID: HifzEntry] = [:]
        for stored in value?["entries"]?.array ?? [] {
            if let entry = entry(stored), entries[entry.id] == nil { entries[entry.id] = entry }
        }
        var plans: [UUID: HifzPlan] = [:]
        for stored in value?["plans"]?.array ?? [] {
            if let plan = plan(stored), plans[plan.id] == nil { plans[plan.id] = plan }
        }
        return Read(
            entries: entries.values.sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) },
            plans: plans.values.sorted { ($0.createdAt, $0.id.uuidString) < ($1.createdAt, $1.id.uuidString) }
        )
    }

    private static func entry(_ stored: JSONValue) -> HifzEntry? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let sura = WebRules.whole(stored["sura"], max: Double(HifzProgress.suraCount)), sura >= 1,
              let day = stored["day"]?.string.flatMap(WebRules.day),
              let at = WebRules.timestamp(stored["at"]),
              let kind = stored["kind"]?.string.flatMap(HifzEntry.Kind.init(rawValue:))
        else { return nil }
        let from = WebRules.whole(stored["from"], max: 286)
        let to = WebRules.whole(stored["to"], max: 286)
        // A range that is there but cannot be read is not the whole surah.
        if (stored["from"] != nil && from == nil) || (stored["to"] != nil && to == nil) { return nil }
        guard HifzEntry.isValid(sura: sura, fromAyah: from, toAyah: to) else { return nil }
        let strength = kind == .reviewed ? WebRules.whole(stored["strength"], max: 3).flatMap(HifzStrength.init(rawValue:)) : nil
        return HifzEntry(id: id, sura: sura, day: day, at: at, kind: kind, fromAyah: from, toAyah: to, strength: strength)
    }

    private static func plan(_ stored: JSONValue) -> HifzPlan? {
        guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)),
              let createdAt = WebRules.timestamp(stored["createdAt"]),
              let start = stored["start"]?.string.flatMap(WebRules.day),
              let target = stored["target"]?.string.flatMap(HifzPlan.Target.init(storage:)),
              let targetDay = stored["targetDay"]?.string.flatMap(WebRules.day), start <= targetDay,
              let daily = WebRules.whole(stored["dailyAyat"], max: Double(HifzPlan.maxDailyAyat)), daily > 0
        else { return nil }
        let ended = WebRules.timestamp(stored["endedAt"])
        if stored["endedAt"] != nil, stored["endedAt"] != .null, ended == nil { return nil }
        return HifzPlan(id: id, createdAt: createdAt, start: start, target: target, targetDay: targetDay, dailyAyat: daily, endedAt: ended)
    }

    static func web(_ entries: [HifzEntry], plans: [HifzPlan]) -> JSONValue {
        var state: [String: JSONValue] = ["entries": .array(entries.map { entry -> JSONValue in
            var fields: [String: JSONValue] = [
                "id": .string(entry.id.uuidString), "sura": JSONValue(entry.sura), "day": .string(entry.day.description),
                "at": JSONValue(ms: entry.at), "kind": .string(entry.kind.rawValue),
            ]
            if let from = entry.fromAyah, let to = entry.toAyah {
                fields["from"] = JSONValue(from)
                fields["to"] = JSONValue(to)
            }
            if let strength = entry.strength { fields["strength"] = JSONValue(strength.rawValue) }
            return .object(fields)
        })]
        if !plans.isEmpty {
            state["plans"] = .array(plans.map { plan -> JSONValue in
                var fields: [String: JSONValue] = [
                    "id": .string(plan.id.uuidString), "createdAt": JSONValue(ms: plan.createdAt), "start": .string(plan.start.description),
                    "target": .string(plan.target.storage), "targetDay": .string(plan.targetDay.description), "dailyAyat": JSONValue(plan.dailyAyat),
                ]
                if let ended = plan.endedAt { fields["endedAt"] = JSONValue(ms: ended) }
                return .object(fields)
            })
        }
        return .object(state)
    }
}
