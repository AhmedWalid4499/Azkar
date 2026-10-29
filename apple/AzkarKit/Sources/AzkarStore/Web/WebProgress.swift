import AzkarCore
import Foundation

/// The website's azkar progress store (`azkar:azkar-progress`), every version:
///  1. `days` (counts) and `history` (completed sessions per day);
///  2. `days`, `sessions` (records with times), `totals`, `totalRecitations`, and `history` again
///     for version 1 builds (src/features/azkar/progressData.ts, progressV1.ts, progressStore.ts);
///  3. (WIP branch) adds `afterPrayer` and `tasbih`; nothing of version 2 changed.
/// Read with the same checks the website applies, and written as version 3, which the website's
/// main branch reads as version 2 (it ignores the two added fields).
struct WebProgress: Equatable {
    static let version = 3
    /// The sessions the website's progress keeps under `days` and `sessions` (`COLLECTION_IDS`).
    static let collections: [AzkarSession] = [.morning, .evening, .sleep]

    var counts: [DayKey: [AzkarSession: [String: Int]]] = [:]
    var sessions: [DayKey: [AzkarSession: SessionRecord]] = [:]
    var totals = LifetimeTotals()
    var tasbih: [DayKey: [String: TasbihCount]] = [:]

    init() {}

    // MARK: Reading

    /// `readProgress(persisted, version)`: the shape decides before the stamp, so no stamp can cost a record.
    init(web value: JSONValue?, version: Double?, catalog: any SessionCatalog) {
        let object = value?.object
        let hasSessions = object?["sessions"]?.object != nil
        let looksLikeVersion1 = object?["history"]?.object != nil && !hasSessions
        if !hasSessions, (version.map { $0 < 2 } ?? false) || looksLikeVersion1 {
            self = Self.migrateVersion1(value, catalog: catalog)
        } else {
            self = Self.sanitized(value)
        }
        readAdded(value)
    }

    /// `sanitizeProgress`: real days, known sessions, whole counts in range, complete records.
    static func sanitized(_ value: JSONValue?) -> WebProgress {
        var data = WebProgress()
        data.counts = sanitizeCounts(value?["days"], sessions: collections.map { ($0.description, $0) })
        data.sessions = sanitizeSessions(value?["sessions"], sessions: collections.map { ($0.description, $0) })
        data.totals.dhikr = sanitizeTally(value?["totals"], max: Double(RecordLimits.maxLifetimeRecitations)) ?? [:]
        let stored = WebRules.whole(value?["totalRecitations"], max: Double(RecordLimits.maxLifetimeRecitations)) ?? 0
        data.totals.recitations = max(stored, data.totals.dhikr.values.reduce(0, +))
        return data
    }

    /// `sanitizeAfterPrayer` and `sanitizeTasbih` of the WIP branch; empty for versions 1 and 2.
    private mutating func readAdded(_ value: JSONValue?) {
        let prayers = Prayer.allCases.map { ($0.rawValue, AzkarSession.afterPrayer($0)) }
        let afterPrayer = value?["afterPrayer"]
        for (day, sessions) in Self.sanitizeCounts(afterPrayer?["days"], sessions: prayers) {
            counts[day, default: [:]].merge(sessions) { _, added in added }
        }
        for (day, records) in Self.sanitizeSessions(afterPrayer?["sessions"], sessions: prayers) {
            sessions[day, default: [:]].merge(records) { _, added in added }
        }
        totals.afterPrayer = Self.sanitizeTally(afterPrayer?["totals"], max: Double(RecordLimits.maxLifetimeRecitations)) ?? [:]

        let stored = value?["tasbih"]
        tasbih = WebRules.dated(stored?["days"], Self.sanitizeTasbihDay)
        totals.tasbih = Self.sanitizeTally(stored?["totals"], max: Double(RecordLimits.maxLifetimeRecitations)) ?? [:]
        totals.tasbihFree = WebRules.whole(stored?["free"], max: Double(RecordLimits.maxLifetimeRecitations)) ?? 0
    }

    /// `sanitizeTally`: positive whole counts up to `max` by valid id, `nil` when none is left.
    static func sanitizeTally(_ value: JSONValue?, max: Double) -> [String: Int]? {
        guard let object = value?.object else { return nil }
        var tally: [String: Int] = [:]
        for (id, count) in object where WebRules.isDhikrID(id) {
            if let count = WebRules.whole(count, max: max), count > 0 { tally[id] = count }
        }
        return tally.isEmpty ? nil : tally
    }

    static func sanitizeCounts(_ value: JSONValue?, sessions: [(String, AzkarSession)]) -> [DayKey: [AzkarSession: [String: Int]]] {
        WebRules.dated(value) { stored -> [AzkarSession: [String: Int]]? in
            guard let object = stored.object else { return nil }
            var day: [AzkarSession: [String: Int]] = [:]
            for (key, session) in sessions {
                if let counts = sanitizeTally(object[key], max: Double(RecordLimits.maxStoredCount)) { day[session] = counts }
            }
            return day.isEmpty ? nil : day
        }
    }

    static func sanitizeSessions(_ value: JSONValue?, sessions: [(String, AzkarSession)]) -> [DayKey: [AzkarSession: SessionRecord]] {
        WebRules.dated(value) { stored -> [AzkarSession: SessionRecord]? in
            guard let object = stored.object else { return nil }
            var day: [AzkarSession: SessionRecord] = [:]
            for (key, session) in sessions {
                if let record = sanitizeRecord(object[key]) { day[session] = record }
            }
            return day.isEmpty ? nil : day
        }
    }

    /// `sanitizeRecord`: every required field sound, or no record. A time that is not a
    /// plausible instant is dropped on its own.
    static func sanitizeRecord(_ value: JSONValue?) -> SessionRecord? {
        guard let object = value?.object, let completed = object["completed"]?.bool,
              let total = WebRules.whole(object["total"], max: Double(RecordLimits.maxSessionSize)),
              let done = WebRules.whole(object["done"], max: Double(total)),
              let recitations = WebRules.whole(object["recitations"], max: Double(RecordLimits.maxSessionRecitations))
        else { return nil }
        return SessionRecord(
            startedAt: WebRules.instant(object["startedAt"]),
            lastAt: WebRules.instant(object["lastAt"]),
            completedAt: completed ? WebRules.instant(object["completedAt"]) : nil,
            completed: completed, done: done, total: total, recitations: recitations
        )
    }

    /// `sanitizeTasbihDay` of the WIP branch: presets by valid id, and the free count.
    static func sanitizeTasbihDay(_ value: JSONValue) -> [String: TasbihCount]? {
        guard let object = value.object else { return nil }
        var day: [String: TasbihCount] = [:]
        for (id, stored) in object["presets"]?.object ?? [:] where WebRules.isDhikrID(id) {
            if let record = sanitizeTasbihRecord(stored) { day[id] = record }
        }
        if let free = sanitizeTasbihRecord(object["free"]) { day[TasbihRecord.freeCount] = free }
        return day.isEmpty ? nil : day
    }

    static func sanitizeTasbihRecord(_ value: JSONValue?) -> TasbihCount? {
        guard let object = value?.object,
              let count = WebRules.whole(object["count"], max: Double(RecordLimits.maxSessionRecitations)), count > 0,
              let current = WebRules.whole(object["current"], max: Double(count))
        else { return nil }
        return TasbihCount(startedAt: WebRules.instant(object["startedAt"]), lastAt: WebRules.instant(object["lastAt"]), count: count, current: current)
    }

    /// `migrateProgressV1`: counts kept as they are; a record for every day with counts or a
    /// completion, without times (version 1 kept none); totals from the counts still kept.
    static func migrateVersion1(_ value: JSONValue?, catalog: any SessionCatalog) -> WebProgress {
        var data = WebProgress()
        data.counts = sanitizeCounts(value?["days"], sessions: collections.map { ($0.description, $0) })
        var history: [DayKey: Set<AzkarSession>] = [:]
        for (key, list) in value?["history"]?.object ?? [:] {
            guard let day = WebRules.day(key), let list = list.array else { continue }
            let completed = Set(collections.filter { list.contains(.string($0.description)) })
            if !completed.isEmpty { history[day] = completed }
        }

        for day in Set(data.counts.keys).union(history.keys).sorted() {
            var records: [AzkarSession: SessionRecord] = [:]
            for session in collections {
                let counts = data.counts[day]?[session]
                let completed = history[day]?.contains(session) ?? false
                guard counts != nil || completed else { continue }
                let items = catalog.items(for: session)
                let done = counts.map { ReadingCount.done(items, $0) } ?? (completed ? items.count : 0)
                let recitations = counts.map { min(RecordLimits.maxSessionRecitations, $0.values.reduce(0, +)) } ?? 0
                records[session] = SessionRecord(completed: completed, done: done, total: items.count, recitations: recitations)
                for (id, count) in counts ?? [:] {
                    data.totals.dhikr[id] = min(RecordLimits.maxLifetimeRecitations, data.totals.dhikr[id, default: 0] + count)
                }
            }
            if !records.isEmpty { data.sessions[day] = records }
        }
        data.totals.recitations = data.totals.dhikr.values.reduce(0, +)
        return data
    }

    // MARK: Writing

    /// The state the website's store saves (version 3, with version 1's `history` beside it).
    var web: JSONValue {
        func dated<T>(_ map: [DayKey: T], _ write: (T) -> JSONValue?) -> JSONValue {
            var out: [String: JSONValue] = [:]
            for (day, value) in map { if let json = write(value) { out[day.description] = json } }
            return .object(out)
        }
        func keyed<T>(_ day: [AzkarSession: T], _ sessions: [(String, AzkarSession)], _ write: (T) -> JSONValue) -> JSONValue? {
            var out: [String: JSONValue] = [:]
            for (key, session) in sessions { if let value = day[session] { out[key] = write(value) } }
            return out.isEmpty ? nil : .object(out)
        }
        let regular = Self.collections.map { ($0.description, $0) }
        let prayers = Prayer.allCases.map { ($0.rawValue, AzkarSession.afterPrayer($0)) }
        let tally = { (counts: [String: Int]) in JSONValue.object(counts.mapValues { JSONValue($0) }) }

        let history = dated(sessions) { day -> JSONValue? in
            let done = Self.collections.filter { day[$0]?.completed == true }
            return done.isEmpty ? nil : .array(done.map { .string($0.description) })
        }
        let tasbihDays = dated(tasbih) { day -> JSONValue? in
            var presets: [String: JSONValue] = [:]
            for (id, count) in day where id != TasbihRecord.freeCount { presets[id] = count.web }
            var out: [String: JSONValue] = ["presets": .object(presets)]
            if let free = day[TasbihRecord.freeCount] { out["free"] = free.web }
            return .object(out)
        }
        return [
            "days": dated(counts) { keyed($0, regular, tally) },
            "sessions": dated(sessions) { keyed($0, regular, \.web) },
            "totals": tally(totals.dhikr),
            "totalRecitations": JSONValue(totals.recitations),
            "history": history,
            "afterPrayer": [
                "days": dated(counts) { keyed($0, prayers, tally) },
                "sessions": dated(sessions) { keyed($0, prayers, \.web) },
                "totals": tally(totals.afterPrayer),
            ],
            "tasbih": ["days": tasbihDays, "totals": tally(totals.tasbih), "free": JSONValue(totals.tasbihFree)],
        ]
    }
}

extension SessionRecord {
    /// A record as the website stores it: times in milliseconds, absent when unknown.
    var web: JSONValue {
        var out: [String: JSONValue] = ["completed": .bool(completed), "done": JSONValue(done), "total": JSONValue(total), "recitations": JSONValue(recitations)]
        if let startedAt { out["startedAt"] = JSONValue(ms: startedAt) }
        if let lastAt { out["lastAt"] = JSONValue(ms: lastAt) }
        if completed, let completedAt { out["completedAt"] = JSONValue(ms: completedAt) }
        return .object(out)
    }
}

extension TasbihCount {
    var web: JSONValue {
        var out: [String: JSONValue] = ["count": JSONValue(count), "current": JSONValue(current)]
        if let startedAt { out["startedAt"] = JSONValue(ms: startedAt) }
        if let lastAt { out["lastAt"] = JSONValue(ms: lastAt) }
        return .object(out)
    }
}
