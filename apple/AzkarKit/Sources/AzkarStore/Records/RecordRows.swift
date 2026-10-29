import AzkarCore
import Foundation
import SwiftData

// Reading and writing rows in one `ModelContext`. Rows hold raw values; anything a later
// version wrote that this one cannot read (an unknown status, say) is skipped, never deleted.

/// The kinds of `TallyRow`.
enum TallyKind {
    static let dhikr = "dhikr"
    static let afterPrayer = "afterPrayer"
    static let tasbih = "tasbih"
    /// Single numbers, keyed by `Counter`.
    static let counter = "counter"

    enum Counter {
        static let recitations = "recitations"
        static let tasbihFree = "tasbihFree"
        static let owedFastsBefore = "owedFastsBefore"
        /// Not a total: the store's revision (see `RecordStore.revision()`).
        static let revision = "revision"
    }
}

struct RecordRows {
    let context: ModelContext

    // MARK: Fetching

    func fetch<T: PersistentModel>(_ predicate: Predicate<T>? = nil) throws -> [T] {
        try context.fetch(FetchDescriptor(predicate: predicate))
    }

    func prayer(_ day: Int, _ prayer: Prayer) throws -> PrayerRow? {
        let key = prayer.rawValue
        return try fetch(#Predicate<PrayerRow> { $0.day == day && $0.prayer == key }).first
    }

    func sunnah(_ day: Int, _ sunnah: SunnahPrayer) throws -> SunnahRow? {
        let key = sunnah.rawValue
        return try fetch(#Predicate<SunnahRow> { $0.day == day && $0.sunnah == key }).first
    }

    func session(_ day: Int, _ session: AzkarSession) throws -> SessionRow? {
        let key = session.description
        return try fetch(#Predicate<SessionRow> { $0.day == day && $0.session == key }).first
    }

    func counts(_ day: Int, _ session: AzkarSession) throws -> [DhikrCountRow] {
        let key = session.description
        return try fetch(#Predicate<DhikrCountRow> { $0.day == day && $0.session == key })
    }

    func tasbih(_ day: Int, _ preset: String) throws -> TasbihRow? {
        try fetch(#Predicate<TasbihRow> { $0.day == day && $0.preset == preset }).first
    }

    func fast(_ day: Int) throws -> FastRow? {
        try fetch(#Predicate<FastRow> { $0.day == day }).first
    }

    func tally(_ kind: String, _ key: String) throws -> TallyRow? {
        try fetch(#Predicate<TallyRow> { $0.kind == kind && $0.key == key }).first
    }

    // MARK: Tallies

    func value(_ kind: String, _ key: String) throws -> Int {
        try tally(kind, key)?.value ?? 0
    }

    func revision() throws -> Int {
        try value(TallyKind.counter, TallyKind.Counter.revision)
    }

    /// Sets a tally entry; 0 removes it.
    func setValue(_ kind: String, _ key: String, _ value: Int) throws {
        let row = try tally(kind, key)
        if value == 0 {
            if let row { context.delete(row) }
        } else if let row {
            row.value = value
        } else {
            context.insert(TallyRow(kind: kind, key: key, value: value))
        }
    }

    /// `withTally`: `change` added to one entry, never below zero nor above the lifetime limit.
    /// Returns how much the entry actually moved.
    @discardableResult
    func adjust(_ kind: String, _ key: String, by change: Int) throws -> Int {
        let before = try value(kind, key)
        guard let after = ReadingCount.tally(before, change: change) else { return 0 }
        try setValue(kind, key, after)
        return after - before
    }

    // MARK: Snapshots

    /// Everything on the days in `days` (all days when `nil`), with the lifetime totals.
    func snapshot(days: ClosedRange<Int>? = nil) throws -> RecordsSnapshot {
        var snapshot = RecordsSnapshot()
        let low = days?.lowerBound ?? Int.min
        let high = days?.upperBound ?? Int.max

        for row in try fetch(#Predicate<PrayerRow> { $0.day >= low && $0.day <= high }) {
            guard let day = DayKey(number: row.day), let prayer = Prayer(rawValue: row.prayer),
                  let status = PrayerStatus(rawValue: row.status) else { continue }
            snapshot.prayers[day, default: DayPrayerRecord()].prayers[prayer] = PrayerEntry(status: status, loggedAt: row.loggedAt?.nearestMillisecond)
        }
        for row in try fetch(#Predicate<SunnahRow> { $0.day >= low && $0.day <= high }) {
            guard let day = DayKey(number: row.day), let sunnah = SunnahPrayer(rawValue: row.sunnah) else { continue }
            snapshot.prayers[day, default: DayPrayerRecord()].sunnah[sunnah] = row.at.nearestMillisecond
        }
        for row in try fetch(#Predicate<SessionRow> { $0.day >= low && $0.day <= high }) {
            guard let day = DayKey(number: row.day), let session = AzkarSession(row.session) else { continue }
            snapshot.sessions[day, default: [:]][session] = row.record
        }
        for row in try fetch(#Predicate<DhikrCountRow> { $0.day >= low && $0.day <= high }) {
            guard let day = DayKey(number: row.day), let session = AzkarSession(row.session), row.count > 0 else { continue }
            snapshot.counts[day, default: [:]][session, default: [:]][row.dhikr] = row.count
        }
        for row in try fetch(#Predicate<TasbihRow> { $0.day >= low && $0.day <= high }) {
            guard let day = DayKey(number: row.day) else { continue }
            snapshot.tasbih[day, default: [:]][row.preset] = TasbihCount(startedAt: row.startedAt?.nearestMillisecond, lastAt: row.lastAt?.nearestMillisecond, count: row.count, current: row.current)
        }
        for row in try fetch(#Predicate<FastRow> { $0.day >= low && $0.day <= high }) {
            guard let day = DayKey(number: row.day), let kind = FastKind(rawValue: row.kind),
                  let status = FastStatus(rawValue: row.status) else { continue }
            snapshot.fasts[day] = FastRecord(kind: kind, status: status, loggedAt: row.loggedAt?.nearestMillisecond)
        }
        snapshot.totals = try totals()
        snapshot.owedFastsBefore = try value(TallyKind.counter, TallyKind.Counter.owedFastsBefore)
        return snapshot
    }

    func totals() throws -> LifetimeTotals {
        var totals = LifetimeTotals()
        let rows: [TallyRow] = try fetch()
        for row in rows {
            switch (row.kind, row.key) {
            case (TallyKind.dhikr, _): totals.dhikr[row.key] = row.value
            case (TallyKind.afterPrayer, _): totals.afterPrayer[row.key] = row.value
            case (TallyKind.tasbih, _): totals.tasbih[row.key] = row.value
            case (TallyKind.counter, TallyKind.Counter.recitations): totals.recitations = row.value
            case (TallyKind.counter, TallyKind.Counter.tasbihFree): totals.tasbihFree = row.value
            default: break
            }
        }
        return totals
    }

    func day(_ day: DayKey) throws -> DayRecords {
        try snapshot(days: day.number...day.number).day(day)
    }

    // MARK: Writing whole snapshots

    /// Deletes every record (the import history and the revision stay). Each row is deleted in
    /// the context, so nothing is gone until the save that also writes what replaces it.
    func deleteAll() throws {
        func delete<T: PersistentModel>(_: T.Type) throws {
            let all: [T] = try fetch()
            for row in all { context.delete(row) }
        }
        try delete(PrayerRow.self)
        try delete(SunnahRow.self)
        try delete(SessionRow.self)
        try delete(DhikrCountRow.self)
        try delete(TasbihRow.self)
        try delete(FastRow.self)
        let revisionKey = TallyKind.Counter.revision
        let counter = TallyKind.counter
        for row in try fetch(#Predicate<TallyRow> { $0.kind != counter || $0.key != revisionKey }) { context.delete(row) }
    }

    /// Inserts what `incoming` holds that `existing` does not. Per day, a prayer, a sunnah
    /// prayer, a session's record, a session's counts, a tasbih counter and a fast are each
    /// kept from `existing` when both have one. Lifetime totals are added together.
    func insert(_ incoming: RecordsSnapshot, over existing: RecordsSnapshot = RecordsSnapshot()) throws {
        for (day, record) in incoming.prayers {
            let have = existing.prayers[day]
            for (prayer, entry) in record.prayers where have?.prayers[prayer] == nil {
                context.insert(PrayerRow(day: day.number, prayer: prayer.rawValue, status: entry.status.rawValue, loggedAt: entry.loggedAt))
            }
            for (sunnah, at) in record.sunnah where have?.sunnah[sunnah] == nil {
                context.insert(SunnahRow(day: day.number, sunnah: sunnah.rawValue, at: at))
            }
        }
        for (day, sessions) in incoming.sessions {
            for (session, record) in sessions where existing.sessions[day]?[session] == nil {
                let row = SessionRow(day: day.number, session: session.description)
                row.record = record
                context.insert(row)
            }
        }
        for (day, sessions) in incoming.counts {
            // A reading is resumed from one set of counts, never a mix of two.
            for (session, counts) in sessions where existing.counts[day]?[session] == nil {
                for (dhikr, count) in counts where count > 0 {
                    context.insert(DhikrCountRow(day: day.number, session: session.description, dhikr: dhikr, count: count))
                }
            }
        }
        for (day, counters) in incoming.tasbih {
            for (preset, counter) in counters where existing.tasbih[day]?[preset] == nil {
                let row = TasbihRow(day: day.number, preset: preset, count: counter.count, current: counter.current)
                row.startedAt = counter.startedAt
                row.lastAt = counter.lastAt
                context.insert(row)
            }
        }
        for (day, fast) in incoming.fasts where existing.fasts[day] == nil {
            context.insert(FastRow(day: day.number, kind: fast.kind.rawValue, status: fast.status.rawValue, loggedAt: fast.loggedAt))
        }

        let limit = RecordLimits.maxLifetimeRecitations
        func added(_ old: Int, _ new: Int) -> Int { min(limit, old + new) }
        let have = existing.totals
        let totals = incoming.totals
        for (id, count) in totals.dhikr { try setValue(TallyKind.dhikr, id, added(have.dhikr[id] ?? 0, count)) }
        for (id, count) in totals.afterPrayer { try setValue(TallyKind.afterPrayer, id, added(have.afterPrayer[id] ?? 0, count)) }
        for (id, count) in totals.tasbih { try setValue(TallyKind.tasbih, id, added(have.tasbih[id] ?? 0, count)) }
        if totals.recitations > 0 {
            try setValue(TallyKind.counter, TallyKind.Counter.recitations, added(have.recitations, totals.recitations))
        }
        if totals.tasbihFree > 0 {
            try setValue(TallyKind.counter, TallyKind.Counter.tasbihFree, added(have.tasbihFree, totals.tasbihFree))
        }
        // The same figure from two places is not twice the days: the one already here stays.
        if existing.owedFastsBefore == 0, incoming.owedFastsBefore > 0 {
            try setValue(TallyKind.counter, TallyKind.Counter.owedFastsBefore, min(RecordLimits.maxOwedFastsBefore, incoming.owedFastsBefore))
        }
    }
}

extension SessionRow {
    var record: SessionRecord {
        get {
            SessionRecord(startedAt: startedAt?.nearestMillisecond, lastAt: lastAt?.nearestMillisecond, completedAt: completedAt?.nearestMillisecond,
                          completed: completed, done: done, total: total, recitations: recitations)
        }
        set {
            startedAt = newValue.startedAt
            lastAt = newValue.lastAt
            completedAt = newValue.completedAt
            completed = newValue.completed
            done = newValue.done
            total = newValue.total
            recitations = newValue.recitations
        }
    }
}
