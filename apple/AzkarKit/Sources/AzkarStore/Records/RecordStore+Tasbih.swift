import AzkarCore
import Foundation

// The tasbih counter and the fasting log, as the website's `wip/web-seven-features` branch
// keeps them (src/features/azkar/tasbihCounts.ts, src/features/fasting/store.ts).

extension RecordStore {
    /// One more on the counter of `preset` (a dhikr id of the catalog's tasbih presets), or of the
    /// free count with `nil`. A counter stops at `RecordLimits.maxSessionRecitations` a day.
    @discardableResult
    public func countTasbih(_ preset: String?, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try tasbih(preset, on: day) { rows, row, key in
            let at = now.wholeMilliseconds
            if let row {
                guard row.count < RecordLimits.maxSessionRecitations else { return .unchanged }
                row.count += 1
                row.current += 1
                row.lastAt = at
            } else {
                let row = TasbihRow(day: day.number, preset: key, count: 1, current: 1)
                row.startedAt = at
                row.lastAt = at
                rows.context.insert(row)
            }
            try self.lifetime(rows, preset, change: 1)
            return .changed
        }
    }

    /// Takes the counter's last count back, while it shows one. A counter left with nothing
    /// counted that day goes.
    @discardableResult
    public func undoTasbih(_ preset: String?, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try tasbih(preset, on: day) { rows, row, _ in
            guard let row, row.current > 0 else { return .unchanged }
            row.count -= 1
            row.current -= 1
            row.lastAt = now.wholeMilliseconds
            if row.count == 0 { rows.context.delete(row) }
            try self.lifetime(rows, preset, change: -1)
            return .changed
        }
    }

    /// Puts the counter back to 0. What was counted that day stays counted.
    @discardableResult
    public func resetTasbih(_ preset: String?, on day: DayKey) throws -> RecordChange {
        try tasbih(preset, on: day) { _, row, _ in
            guard let row, row.current > 0 else { return .unchanged }
            row.current = 0
            return .changed
        }
    }

    private func tasbih(_ preset: String?, on day: DayKey, _ body: (RecordRows, TasbihRow?, String) throws -> ChangeResult) throws -> RecordChange {
        // `isTasbihSlot`: a preset of the dataset's list, or the free count.
        let known = preset.map { catalog.tasbihPresets.contains($0) } ?? true
        let key = preset ?? TasbihRecord.freeCount
        return try change(day) { rows in
            guard known else { return (.unchanged, [:]) }
            return (try body(rows, try rows.tasbih(day.number, key), key), [:])
        }
    }

    private func lifetime(_ rows: RecordRows, _ preset: String?, change: Int) throws {
        if let preset {
            try rows.adjust(TallyKind.tasbih, preset, by: change)
        } else {
            let free = try rows.value(TallyKind.counter, TallyKind.Counter.tasbihFree)
            try rows.setValue(TallyKind.counter, TallyKind.Counter.tasbihFree, min(RecordLimits.maxLifetimeRecitations, max(0, free + change)))
        }
    }

    // MARK: Fasting

    /// `setFast`: logs a day's fast, stamped with `now`. The same kind and status again changes
    /// nothing, its time included. A day that has not begun cannot be logged.
    @discardableResult
    public func setFast(_ kind: FastKind, _ status: FastStatus, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        let today = today(at: now)
        return try change(day) { rows in
            let row = try rows.fast(day.number)
            if let row, row.kind == kind.rawValue, row.status == status.rawValue { return (.unchanged, [:]) }
            if day > today { return (.refusedFutureDay, [:]) }
            let at = now.wholeMilliseconds
            if let row {
                row.kind = kind.rawValue
                row.status = status.rawValue
                row.loggedAt = at
            } else {
                rows.context.insert(FastRow(day: day.number, kind: kind.rawValue, status: status.rawValue, loggedAt: at))
            }
            return (.changed, [:])
        }
    }

    /// Clears a day's fast.
    @discardableResult
    public func clearFast(on day: DayKey) throws -> RecordChange {
        try change(day) { rows in
            guard let row = try rows.fast(day.number) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }

    /// `setOwedBefore`: the days of Ramadan owed from before the log began, 0 to
    /// `RecordLimits.maxOwedFastsBefore`. The change describes today.
    @discardableResult
    public func setOwedFastsBefore(_ days: Int, at now: Date = .now) throws -> RecordChange {
        let owed = min(RecordLimits.maxOwedFastsBefore, max(0, days))
        return try change(today(at: now)) { rows in
            guard try rows.value(TallyKind.counter, TallyKind.Counter.owedFastsBefore) != owed else { return (.unchanged, [:]) }
            try rows.setValue(TallyKind.counter, TallyKind.Counter.owedFastsBefore, owed)
            return (.changed, [:])
        }
    }
}
