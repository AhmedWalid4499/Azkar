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
    /// Prayers owed from before the log began, by prayer.
    static let owedPrayers = "owedPrayers"
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

    func quranEntry(_ id: UUID) throws -> QuranEntryRow? {
        try fetch(#Predicate<QuranEntryRow> { $0.id == id }).first
    }

    func hifzEntry(_ id: UUID) throws -> HifzEntryRow? {
        try fetch(#Predicate<HifzEntryRow> { $0.id == id }).first
    }

    func makeup(_ id: UUID) throws -> PrayerMakeupRow? {
        try fetch(#Predicate<PrayerMakeupRow> { $0.id == id }).first
    }

    func giving(_ id: UUID) throws -> GivingRow? {
        try fetch(#Predicate<GivingRow> { $0.id == id }).first
    }

    func dua(_ id: UUID) throws -> DuaRow? {
        try fetch(#Predicate<DuaRow> { $0.id == id }).first
    }

    func duaEntry(_ id: UUID) throws -> DuaEntryRow? {
        try fetch(#Predicate<DuaEntryRow> { $0.id == id }).first
    }

    func quranBookmark(_ page: Int) throws -> QuranBookmarkRow? {
        try fetch(#Predicate<QuranBookmarkRow> { $0.page == page }).first
    }

    func season(_ day: Int, _ deed: SeasonDeed) throws -> SeasonRow? {
        let key = deed.rawValue
        return try fetch(#Predicate<SeasonRow> { $0.day == day && $0.deed == key }).first
    }

    /// The Quran log on the days in `days` (all days when `nil`), in order.
    func quranEntries(days: ClosedRange<Int>? = nil) throws -> [QuranEntry] {
        let low = days?.lowerBound ?? Int.min
        let high = days?.upperBound ?? Int.max
        return try fetch(#Predicate<QuranEntryRow> { $0.day >= low && $0.day <= high }).compactMap(\.entry).inLogOrder
    }

    /// The memorisation log on the days in `days` (all days when `nil`), in order.
    func hifzEntries(days: ClosedRange<Int>? = nil) throws -> [HifzEntry] {
        let low = days?.lowerBound ?? Int.min
        let high = days?.upperBound ?? Int.max
        return try fetch(#Predicate<HifzEntryRow> { $0.day >= low && $0.day <= high }).compactMap(\.entry)
            .sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }

    /// The prayers made up on the days in `days` (all days when `nil`), in order.
    func makeups(days: ClosedRange<Int>? = nil) throws -> [PrayerMakeup] {
        let low = days?.lowerBound ?? Int.min
        let high = days?.upperBound ?? Int.max
        return try fetch(#Predicate<PrayerMakeupRow> { $0.day >= low && $0.day <= high }).compactMap(\.makeup)
            .sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }

    /// What was given on the days in `days` (all days when `nil`), in order.
    func giving(days: ClosedRange<Int>? = nil) throws -> [GivingEntry] {
        let low = days?.lowerBound ?? Int.min
        let high = days?.upperBound ?? Int.max
        return try fetch(#Predicate<GivingRow> { $0.day >= low && $0.day <= high }).compactMap(\.entry)
            .sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }

    /// The duas' log on the days in `days` (all days when `nil`), in order.
    func duaEntries(days: ClosedRange<Int>? = nil) throws -> [DuaEntry] {
        let low = days?.lowerBound ?? Int.min
        let high = days?.upperBound ?? Int.max
        return try fetch(#Predicate<DuaEntryRow> { $0.day >= low && $0.day <= high }).compactMap(\.entry)
            .sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }

    func duas() throws -> [DuaItem] {
        let rows: [DuaRow] = try fetch()
        return rows.map { DuaItem(id: $0.id, text: $0.text, addedAt: $0.addedAt.nearestMillisecond) }
            .sorted { ($0.addedAt, $0.id.uuidString) < ($1.addedAt, $1.id.uuidString) }
    }

    func owedPrayersBefore() throws -> [Prayer: Int] {
        var owed: [Prayer: Int] = [:]
        for prayer in Prayer.allCases {
            let count = try value(TallyKind.owedPrayers, prayer.rawValue)
            if count > 0 { owed[prayer] = count }
        }
        return owed
    }

    func quranBookmarks() throws -> [Int: Date] {
        let rows: [QuranBookmarkRow] = try fetch()
        return Dictionary(rows.map { ($0.page, $0.at.nearestMillisecond) }) { first, _ in first }
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

    /// Everything on the days in `days` (all days when `nil`), with the lifetime totals and the
    /// Quran bookmarks, which belong to no day.
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
        for row in try fetch(#Predicate<SeasonRow> { $0.day >= low && $0.day <= high }) {
            guard let record = row.record else { continue }
            snapshot.seasons[record.day, default: [:]][record.deed] = record
        }
        snapshot.quran = try quranEntries(days: days)
        snapshot.quranBookmarks = try quranBookmarks()
        snapshot.hifz = try hifzEntries(days: days)
        snapshot.makeups = try makeups(days: days)
        snapshot.giving = try giving(days: days)
        snapshot.duaEntries = try duaEntries(days: days)
        snapshot.duas = try duas()
        snapshot.owedPrayersBefore = try owedPrayersBefore()
        if days == nil { snapshot.companion = try companionConversations() }
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
        try delete(QuranEntryRow.self)
        try delete(QuranBookmarkRow.self)
        try delete(SeasonRow.self)
        try delete(HifzEntryRow.self)
        try delete(PrayerMakeupRow.self)
        try delete(GivingRow.self)
        try delete(DuaRow.self)
        try delete(DuaEntryRow.self)
        try delete(CompanionRow.self)
        let revisionKey = TallyKind.Counter.revision
        let counter = TallyKind.counter
        for row in try fetch(#Predicate<TallyRow> { $0.kind != counter || $0.key != revisionKey }) { context.delete(row) }
    }

    func insert(_ entry: QuranEntry) {
        context.insert(QuranEntryRow(id: entry.id, day: entry.day.number, at: entry.at, kind: entry.kind.rawValue, fromPage: entry.fromPage, toPage: entry.toPage))
    }

    func insert(_ entry: HifzEntry) {
        context.insert(HifzEntryRow(id: entry.id, sura: entry.sura, day: entry.day.number, at: entry.at, kind: entry.kind.rawValue))
    }

    func insert(_ makeup: PrayerMakeup) {
        context.insert(PrayerMakeupRow(id: makeup.id, prayer: makeup.prayer.rawValue, day: makeup.day.number, at: makeup.at))
    }

    func insert(_ entry: GivingEntry) {
        context.insert(GivingRow(id: entry.id, kind: entry.kind.rawValue, day: entry.day.number, at: entry.at,
                                 amount: entry.amount.map { "\($0)" }, currency: entry.currency, note: entry.note))
    }

    func insert(_ dua: DuaItem) {
        context.insert(DuaRow(id: dua.id, text: dua.text, addedAt: dua.addedAt))
    }

    func insert(_ entry: DuaEntry) {
        context.insert(DuaEntryRow(id: entry.id, dua: entry.dua, day: entry.day.number, at: entry.at, kind: entry.kind.rawValue))
    }

    func insert(_ record: SeasonRecord) {
        context.insert(SeasonRow(day: record.day.number, deed: record.deed.rawValue, at: record.at, place: record.place?.rawValue, rakahs: record.rakahs))
    }

    /// Inserts what `incoming` holds that `existing` does not. Per day, a prayer, a sunnah
    /// prayer, a session's record, a session's counts, a tasbih counter, a fast and a season
    /// record of each deed are each kept from `existing` when both have one, as are a Quran
    /// entry with the same id and a bookmark on the same page. Lifetime totals are added together.
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
        let entries = Set(existing.quran.map(\.id))
        for entry in incoming.quran where !entries.contains(entry.id) { insert(entry) }
        for (page, at) in incoming.quranBookmarks where existing.quranBookmarks[page] == nil {
            context.insert(QuranBookmarkRow(page: page, at: at))
        }
        for (day, records) in incoming.seasons {
            for (deed, record) in records where existing.seasons[day]?[deed] == nil { insert(record) }
        }
        let hifz = Set(existing.hifz.map(\.id))
        for entry in incoming.hifz where !hifz.contains(entry.id) { insert(entry) }
        let makeups = Set(existing.makeups.map(\.id))
        for makeup in incoming.makeups where !makeups.contains(makeup.id) { insert(makeup) }
        let giving = Set(existing.giving.map(\.id))
        for entry in incoming.giving where !giving.contains(entry.id) { insert(entry) }
        let duas = Set(existing.duas.map(\.id))
        for dua in incoming.duas where !duas.contains(dua.id) { insert(dua) }
        let duaEntries = Set(existing.duaEntries.map(\.id))
        for entry in incoming.duaEntries where !duaEntries.contains(entry.id) { insert(entry) }
        let conversations = Set(existing.companion.map(\.id))
        for conversation in incoming.companion where !conversations.contains(conversation.id) { insert(conversation) }

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
        for (prayer, count) in incoming.owedPrayersBefore where (existing.owedPrayersBefore[prayer] ?? 0) == 0 && count > 0 {
            try setValue(TallyKind.owedPrayers, prayer.rawValue, min(RecordLimits.maxOwedPrayersBefore, count))
        }
    }
}

extension HifzEntryRow {
    var entry: HifzEntry? {
        guard let day = DayKey(number: day), let kind = HifzEntry.Kind(rawValue: kind) else { return nil }
        return HifzEntry(id: id, sura: sura, day: day, at: at.nearestMillisecond, kind: kind)
    }
}

extension PrayerMakeupRow {
    var makeup: PrayerMakeup? {
        guard let day = DayKey(number: day), let prayer = Prayer(rawValue: prayer) else { return nil }
        return PrayerMakeup(id: id, prayer: prayer, day: day, at: at.nearestMillisecond)
    }
}

extension GivingRow {
    var entry: GivingEntry? {
        guard let day = DayKey(number: day), let kind = GivingEntry.Kind(rawValue: kind) else { return nil }
        return GivingEntry(id: id, kind: kind, day: day, at: at.nearestMillisecond, amount: amount.flatMap { Decimal(string: $0, locale: Locale(identifier: "en_US_POSIX")) }, currency: currency, note: note)
    }
}

extension DuaEntryRow {
    var entry: DuaEntry? {
        guard let day = DayKey(number: day), let kind = DuaEntry.Kind(rawValue: kind) else { return nil }
        return DuaEntry(id: id, dua: dua, day: day, at: at.nearestMillisecond, kind: kind)
    }
}

extension QuranEntryRow {
    var entry: QuranEntry? {
        guard let day = DayKey(number: day), let kind = QuranEntry.Kind(rawValue: kind) else { return nil }
        return QuranEntry(id: id, day: day, at: at.nearestMillisecond, kind: kind, fromPage: fromPage, toPage: toPage)
    }
}

extension SeasonRow {
    /// `nil` for what a later version wrote that this one cannot read.
    var record: SeasonRecord? {
        guard let day = DayKey(number: day), let deed = SeasonDeed(rawValue: deed) else { return nil }
        let known = place.flatMap(WorshipPlace.init(rawValue:))
        guard known != nil || place == nil else { return nil }
        return SeasonRecord(deed: deed, day: day, at: at.nearestMillisecond, place: known, rakahs: rakahs)
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
