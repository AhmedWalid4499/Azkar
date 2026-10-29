import AzkarCore
import Foundation

extension RecordStore {
    /// One tap in the reader: `applyCount` of the website (`countIn` for the after-prayer azkar).
    ///
    /// The dhikr's count moves within 0…its count; the day's session record follows it (a
    /// completion is set the moment the last dhikr reaches its count, and withdrawn when a count
    /// is taken back from a complete reading); the lifetime totals move by what the count moved.
    /// A dhikr the session does not hold, or a count that cannot move, changes nothing. Any day
    /// can be counted, as on the website.
    @discardableResult
    public func count(_ step: CountStep, dhikr: String, in session: AzkarSession, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        let items = catalog.items(for: session)
        return try change(day) { rows in
            let countRows = try rows.counts(day.number, session)
            var counts: [String: Int] = [:]
            for row in countRows { counts[row.dhikr] = row.count }
            let sessionRow = try rows.session(day.number, session)
            guard let outcome = ReadingCount.apply(step, to: dhikr, items: items, counts: counts, record: sessionRow?.record, at: now.wholeMilliseconds) else {
                return (.unchanged, [:])
            }

            let after = outcome.counts[dhikr]
            if let row = countRows.first(where: { $0.dhikr == dhikr }) {
                if let after { row.count = after } else { rows.context.delete(row) }
            } else if let after {
                rows.context.insert(DhikrCountRow(day: day.number, session: session.description, dhikr: dhikr, count: after))
            }

            switch (outcome.record, sessionRow) {
            case let (record?, row?): row.record = record
            case let (record?, nil):
                let row = SessionRow(day: day.number, session: session.description)
                row.record = record
                rows.context.insert(row)
            case let (nil, row?): rows.context.delete(row)
            case (nil, nil): break
            }

            let moved = try rows.adjust(TallyKind.dhikr, dhikr, by: outcome.change)
            if moved != 0 {
                let total = try rows.value(TallyKind.counter, TallyKind.Counter.recitations)
                try rows.setValue(TallyKind.counter, TallyKind.Counter.recitations, min(RecordLimits.maxLifetimeRecitations, max(0, total + moved)))
            }
            if case .afterPrayer = session {
                try rows.adjust(TallyKind.afterPrayer, dhikr, by: outcome.change)
            }
            return (.changed, try pruneCounts(rows, before: day, like: session))
        }
    }

    /// "Start over": clears a session's counts for the day. Its record keeps its completion and
    /// its recitations; its `done` goes back to 0 (`applyReset`). Nothing counted, nothing to do.
    @discardableResult
    public func startOver(_ session: AzkarSession, on day: DayKey) throws -> RecordChange {
        try change(day) { rows in
            let countRows = try rows.counts(day.number, session)
            guard !countRows.isEmpty else { return (.unchanged, [:]) }
            for row in countRows { rows.context.delete(row) }
            if let record = try rows.session(day.number, session), record.done != 0 { record.done = 0 }
            return (.changed, try pruneCounts(rows, before: day, like: session))
        }
    }

    /// `pruneOlderThan(days, day, DETAIL_DAYS)`: the counts of the same kind of reading (the
    /// sessions of the day, or the azkar after the prayers) more than 30 days older than `day`.
    private func pruneCounts(_ rows: RecordRows, before day: DayKey, like session: AzkarSession) throws -> [DayKey: Set<AzkarSession>] {
        let cutoff = day.adding(days: -RecordLimits.detailDays).number
        let afterPrayer = session.isAfterPrayer
        var pruned: [DayKey: Set<AzkarSession>] = [:]
        for row in try rows.fetch(#Predicate<DhikrCountRow> { $0.day < cutoff }) {
            guard let old = AzkarSession(row.session), old.isAfterPrayer == afterPrayer, let oldDay = DayKey(number: row.day) else { continue }
            rows.context.delete(row)
            pruned[oldDay, default: []].insert(old)
        }
        return pruned
    }
}

extension AzkarSession {
    var isAfterPrayer: Bool {
        if case .afterPrayer = self { true } else { false }
    }
}
