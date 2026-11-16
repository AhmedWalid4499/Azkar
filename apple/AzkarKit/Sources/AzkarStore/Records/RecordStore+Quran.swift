import AzkarCore
import Foundation

// Quran reading: an append-only log, one row per thing recorded. Position, totals and khatmahs
// are never stored; they are worked out from the log (`QuranProgress`), so taking an entry back
// restores them by itself. The native app's own: the website has no Quran.

extension RecordStore {
    /// "Stopped here": moved to `toPage` (kept to 1...604) from the current position. Going
    /// backwards is logged too, as a correction: it adds no pages and moves the position.
    /// `day` is the day the reading counts for, which can be the day before `at`'s date.
    @discardableResult
    public func logQuranReading(toPage: Int, on day: DayKey, at now: Date = .now) throws -> QuranEntry {
        try addQuranReading(toPage: toPage, on: day, at: now).entry
    }

    /// A khatmah added by hand, read from a paper mushaf for instance. It counts as a khatmah and
    /// leaves the position in the app's mushaf where it is.
    @discardableResult
    public func logKhatmah(on day: DayKey, at now: Date = .now) throws -> QuranEntry {
        try addKhatmah(on: day, at: now).entry
    }

    /// Adds a line to the memorisation log. A surah that does not exist changes nothing.
    @discardableResult
    public func logHifz(_ kind: HifzEntry.Kind, sura: Int, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try addHifz(kind, sura: sura, on: day, at: now)
    }

    /// Adds lines to the memorisation log, one per span, as one change: some ayat memorised, or
    /// reviewed with how it went. Spans that are not ayat of the Qur'an are left out; when none is
    /// left nothing changes. A strength is kept on reviews only.
    @discardableResult
    public func logHifz(_ kind: HifzEntry.Kind, spans: [AyahSpan], strength: HifzStrength? = nil, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try addHifz(kind, spans: spans, strength: strength, on: day, at: now)
    }

    /// Starts a memorisation plan. A plan already running is ended by it: one runs at a time.
    @discardableResult
    public func startHifzPlan(_ target: HifzPlan.Target, from start: DayKey, to targetDay: DayKey, dailyAyat: Int, at now: Date = .now) throws -> RecordChange {
        try addHifzPlan(target, from: start, to: targetDay, dailyAyat: dailyAyat, at: now)
    }

    /// Ends a running plan; it stays in the records.
    @discardableResult
    public func endHifzPlan(_ id: UUID, at now: Date = .now) throws -> RecordChange {
        try finishHifzPlan(id, at: now)
    }

    /// The memorisation log, in the order it happened.
    public func hifzLog() throws -> [HifzEntry] {
        try rows().hifzEntries()
    }

    /// Takes a line out of the memorisation log, as an undo.
    public func undoHifzEntry(_ id: UUID) throws {
        _ = try removeHifzEntry(id)
    }

    /// Takes an entry out of the log, and with it whatever it added. An id not in the log changes nothing.
    public func undoQuranEntry(_ id: UUID) throws {
        _ = try removeQuranEntry(id)
    }

    /// Sets or clears a page's bookmark. A page already so keeps its time; what is not a page of
    /// the mushaf changes nothing.
    public func setQuranBookmark(page: Int, on: Bool, at now: Date = .now) throws {
        _ = try changeQuranBookmark(page: page, on: on, at: now)
    }

    // The same, with the change `RecordsModel` shows.

    func addHifz(_ kind: HifzEntry.Kind, sura: Int, on day: DayKey, at now: Date) throws -> RecordChange {
        try change(day) { rows in
            guard (1...HifzProgress.suraCount).contains(sura) else { return (.unchanged, [:]) }
            rows.insert(HifzEntry(sura: sura, day: day, at: now.wholeMilliseconds, kind: kind))
            return (.changed, [:])
        }
    }

    func addHifz(_ kind: HifzEntry.Kind, spans: [AyahSpan], strength: HifzStrength?, on day: DayKey, at now: Date) throws -> RecordChange {
        try change(day) { rows in
            let valid = spans.filter { HifzEntry.isValid(sura: $0.sura, fromAyah: $0.from, toAyah: $0.to) }
            guard !valid.isEmpty else { return (.unchanged, [:]) }
            let at = now.wholeMilliseconds
            for span in valid {
                rows.insert(HifzEntry(span: span, day: day, at: at, kind: kind, strength: kind == .reviewed ? strength : nil))
            }
            return (.changed, [:])
        }
    }

    func addHifzPlan(_ target: HifzPlan.Target, from start: DayKey, to targetDay: DayKey, dailyAyat: Int, at now: Date) throws -> RecordChange {
        try change(start) { rows in
            guard target.isValid, start <= targetDay, dailyAyat > 0 else { return (.unchanged, [:]) }
            let at = now.wholeMilliseconds
            for row in try rows.fetch(#Predicate<HifzPlanRow> { $0.endedAt == nil }) { row.endedAt = at }
            rows.insert(HifzPlan(createdAt: at, start: start, target: target, targetDay: targetDay,
                                 dailyAyat: min(dailyAyat, HifzPlan.maxDailyAyat)))
            return (.changed, [:])
        }
    }

    func finishHifzPlan(_ id: UUID, at now: Date) throws -> RecordChange {
        try change(today(at: now)) { rows in
            guard let row = try rows.hifzPlan(id), row.endedAt == nil else { return (.unchanged, [:]) }
            row.endedAt = now.wholeMilliseconds
            return (.changed, [:])
        }
    }

    /// `nil` when the entry is not in the log.
    func removeHifzEntry(_ id: UUID) throws -> RecordChange? {
        guard let day = try rows().hifzEntry(id).flatMap({ DayKey(number: $0.day) }) else { return nil }
        return try change(day) { rows in
            guard let row = try rows.hifzEntry(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }

    func addQuranReading(toPage: Int, on day: DayKey, at now: Date) throws -> (entry: QuranEntry, change: RecordChange) {
        let log = try rows().quranEntries()
        // The log's order is what happened: a reading is never filed before the last one, which
        // would leave the position behind when the clock was put back.
        var at = now.wholeMilliseconds
        if let last = log.last(where: { $0.kind == .read })?.at, at <= last {
            at = Date(epochMilliseconds: last.epochMilliseconds + 1)
        }
        let page = min(QuranProgress.pageCount, max(1, toPage))
        let entry = QuranEntry(day: day, at: at, kind: .read, fromPage: QuranProgress(entries: log).position, toPage: page)
        return (entry, try add(entry))
    }

    func addKhatmah(on day: DayKey, at now: Date) throws -> (entry: QuranEntry, change: RecordChange) {
        let position = QuranProgress(entries: try rows().quranEntries()).position
        let entry = QuranEntry(day: day, at: now.wholeMilliseconds, kind: .khatmah, fromPage: position, toPage: 0)
        return (entry, try add(entry))
    }

    /// `nil` when the entry is not in the log.
    func removeQuranEntry(_ id: UUID) throws -> RecordChange? {
        guard let day = try rows().quranEntry(id).flatMap({ DayKey(number: $0.day) }) else { return nil }
        return try change(day) { rows in
            guard let row = try rows.quranEntry(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }

    func changeQuranBookmark(page: Int, on: Bool, at now: Date) throws -> RecordChange {
        try change(today(at: now)) { rows in
            guard (1...QuranProgress.pageCount).contains(page) else { return (.unchanged, [:]) }
            let row = try rows.quranBookmark(page)
            switch (row, on) {
            case (nil, true): rows.context.insert(QuranBookmarkRow(page: page, at: now.wholeMilliseconds))
            case let (row?, false): rows.context.delete(row)
            default: return (.unchanged, [:])
            }
            return (.changed, [:])
        }
    }

    private func add(_ entry: QuranEntry) throws -> RecordChange {
        try change(entry.day) { rows in
            rows.insert(entry)
            return (.changed, [:])
        }
    }
}
