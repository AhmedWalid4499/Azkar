import AzkarCore
import Foundation

extension RecordStore {
    /// One tap on a prayer not yet logged: prayed on time. A prayer already logged is left as it
    /// is (the website then offers the other statuses instead).
    @discardableResult
    public func logPrayer(_ prayer: Prayer, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        if try rows().prayer(day.number, prayer) != nil {
            return try change(day) { _ in (.unchanged, [:]) }
        }
        return try setPrayer(prayer, .ontime, on: day, at: now)
    }

    /// `setStatus`: sets a prayer's status, stamped with `now`, or clears it with `nil`. The same
    /// status again changes nothing (its time included). A day that has not begun can be
    /// cleared, not logged.
    @discardableResult
    public func setPrayer(_ prayer: Prayer, _ status: PrayerStatus?, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        let today = today(at: now)
        return try change(day) { rows in
            let row = try rows.prayer(day.number, prayer)
            let current = row.flatMap { PrayerStatus(rawValue: $0.status) }
            if current == status, row == nil || current != nil { return (.unchanged, [:]) }
            guard let status else {
                if let row { rows.context.delete(row) }
                return (.changed, [:])
            }
            if day > today { return (.refusedFutureDay, [:]) }
            let at = now.wholeMilliseconds
            if let row {
                row.status = status.rawValue
                row.loggedAt = at
            } else {
                rows.context.insert(PrayerRow(day: day.number, prayer: prayer.rawValue, status: status.rawValue, loggedAt: at))
            }
            return (.changed, [:])
        }
    }

    /// Clears a prayer's status.
    @discardableResult
    public func clearPrayer(_ prayer: Prayer, on day: DayKey) throws -> RecordChange {
        try setPrayer(prayer, nil, on: day)
    }

    /// `setSunnah`: ticks a sunnah prayer off for a day, stamped with `now`, or unticks it.
    /// A day that has not begun cannot be ticked.
    @discardableResult
    public func setSunnah(_ sunnah: SunnahPrayer, done: Bool, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        let today = today(at: now)
        return try change(day) { rows in
            let row = try rows.sunnah(day.number, sunnah)
            if (row != nil) == done { return (.unchanged, [:]) }
            if let row {
                rows.context.delete(row)
                return (.changed, [:])
            }
            if day > today { return (.refusedFutureDay, [:]) }
            rows.context.insert(SunnahRow(day: day.number, sunnah: sunnah.rawValue, at: now.wholeMilliseconds))
            return (.changed, [:])
        }
    }
}
