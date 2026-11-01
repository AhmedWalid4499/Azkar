import AzkarCore
import Foundation

// Prayers made up from before the log began, what was given and the user's duas: the native app's
// own, like the Quran. Each is a log kept for good; what is left, what it comes to and which duas
// are answered are worked out from it (`PrayerBacklog`, `GivingSummary`, `DuaProgress`), so taking
// a line back restores them by itself.

extension RecordStore {
    // MARK: Prayers made up

    /// One prayer made up from those owed from before the log began.
    public func logMakeup(_ prayer: Prayer, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try change(day) { rows in
            guard day <= today(at: now) else { return (.refusedFutureDay, [:]) }
            rows.insert(PrayerMakeup(prayer: prayer, day: day, at: now.wholeMilliseconds))
            return (.changed, [:])
        }
    }

    /// `nil` when the line is not in the log.
    public func undoMakeup(_ id: UUID) throws -> RecordChange? {
        guard let day = try rows().makeup(id).flatMap({ DayKey(number: $0.day) }) else { return nil }
        return try change(day) { rows in
            guard let row = try rows.makeup(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }

    /// What the user counts as owed from before the log began. A prayer left out owes nothing.
    public func setOwedPrayersBefore(_ owed: [Prayer: Int], at now: Date = .now) throws -> RecordChange {
        try change(today(at: now)) { rows in
            var changed = false
            for prayer in Prayer.allCases {
                let count = min(RecordLimits.maxOwedPrayersBefore, max(0, owed[prayer] ?? 0))
                guard try rows.value(TallyKind.owedPrayers, prayer.rawValue) != count else { continue }
                try rows.setValue(TallyKind.owedPrayers, prayer.rawValue, count)
                changed = true
            }
            return (changed ? .changed : .unchanged, [:])
        }
    }

    // MARK: Giving

    /// Adds a line to the giving log.
    public func logGiving(_ entry: GivingEntry) throws -> RecordChange {
        try change(entry.day) { rows in
            guard entry.day <= today(at: entry.at) else { return (.refusedFutureDay, [:]) }
            var kept = entry
            kept.at = entry.at.wholeMilliseconds
            rows.insert(kept)
            return (.changed, [:])
        }
    }

    /// `nil` when the line is not in the log.
    public func removeGiving(_ id: UUID) throws -> RecordChange? {
        guard let day = try rows().giving(id).flatMap({ DayKey(number: $0.day) }) else { return nil }
        return try change(day) { rows in
            guard let row = try rows.giving(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }

    // MARK: Duas

    /// Adds a dua; nothing but spaces changes nothing.
    public func addDua(_ text: String, at now: Date = .now) throws -> RecordChange {
        try change(today(at: now)) { rows in
            guard let text = DuaItem.cleaned(text) else { return (.unchanged, [:]) }
            rows.insert(DuaItem(text: text, addedAt: now.wholeMilliseconds))
            return (.changed, [:])
        }
    }

    /// Rewrites a dua. It stays the same dua, with all that was logged of it.
    public func editDua(_ id: UUID, text: String, at now: Date = .now) throws -> RecordChange {
        try change(today(at: now)) { rows in
            guard let text = DuaItem.cleaned(text), let row = try rows.dua(id), row.text != text else { return (.unchanged, [:]) }
            row.text = text
            return (.changed, [:])
        }
    }

    /// Takes a dua off the list. Its words go; the days it was said stay counted.
    public func removeDua(_ id: UUID, at now: Date = .now) throws -> RecordChange {
        try change(today(at: now)) { rows in
            guard let row = try rows.dua(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }

    /// Adds a line to the duas' log. An answered dua stays answered once, whatever is tapped twice.
    public func logDua(_ kind: DuaEntry.Kind, dua: UUID, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try change(day) { rows in
            guard day <= today(at: now) else { return (.refusedFutureDay, [:]) }
            guard try rows.dua(dua) != nil else { return (.unchanged, [:]) }
            if kind == .answered, try rows.duaEntries().contains(where: { $0.dua == dua && $0.kind == .answered }) {
                return (.unchanged, [:])
            }
            rows.insert(DuaEntry(dua: dua, day: day, at: now.wholeMilliseconds, kind: kind))
            return (.changed, [:])
        }
    }

    /// Several duas said at once, as one change.
    public func logDuasSaid(_ duas: [UUID], on day: DayKey, at now: Date = .now) throws -> RecordChange {
        try change(day) { rows in
            guard day <= today(at: now) else { return (.refusedFutureDay, [:]) }
            let known = Set(try rows.duas().map(\.id))
            let said = duas.filter(known.contains)
            for dua in said { rows.insert(DuaEntry(dua: dua, day: day, at: now.wholeMilliseconds, kind: .said)) }
            return (said.isEmpty ? .unchanged : .changed, [:])
        }
    }

    /// `nil` when the line is not in the log.
    public func undoDuaEntry(_ id: UUID) throws -> RecordChange? {
        guard let day = try rows().duaEntry(id).flatMap({ DayKey(number: $0.day) }) else { return nil }
        return try change(day) { rows in
            guard let row = try rows.duaEntry(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }
}
