import AzkarCore
import Foundation

// Ramadan and the Eids: one record per deed per day, kept for good. A night's tarawih is filed
// under the civil day whose evening the night falls on, whatever the clock says when it is
// logged: the caller decides the day, as for the Quran. The native app's own: the website has none.

extension RecordStore {
    /// Records a deed on a day, or changes where and how it was prayed: a record already there
    /// takes the new place and rakahs and keeps its time. Rakahs outside `SeasonRecord.rakahsRange`
    /// are no count and become `nil`. The same values again change nothing. A day that has not
    /// begun cannot be logged, as with the prayers, the sunnah and the fasts.
    public func setSeasonRecord(_ deed: SeasonDeed, place: WorshipPlace?, rakahs: Int?, on day: DayKey, at now: Date = .now) throws {
        _ = try changeSeasonRecord(deed, place: place, rakahs: rakahs, on: day, at: now)
    }

    /// Takes a deed off a day. Nothing to take off changes nothing.
    public func clearSeasonRecord(_ deed: SeasonDeed, on day: DayKey) throws {
        _ = try removeSeasonRecord(deed, on: day)
    }

    // The same, with the change `RecordsModel` shows.

    func changeSeasonRecord(_ deed: SeasonDeed, place: WorshipPlace?, rakahs: Int?, on day: DayKey, at now: Date) throws -> RecordChange {
        let today = today(at: now)
        let rakahs = rakahs.flatMap { SeasonRecord.rakahsRange.contains($0) ? $0 : nil }
        return try change(day) { rows in
            let row = try rows.season(day.number, deed)
            if let row, row.place == place?.rawValue, row.rakahs == rakahs { return (.unchanged, [:]) }
            if day > today { return (.refusedFutureDay, [:]) }
            if let row {
                row.place = place?.rawValue
                row.rakahs = rakahs
            } else {
                rows.insert(SeasonRecord(deed: deed, day: day, at: now.wholeMilliseconds, place: place, rakahs: rakahs))
            }
            return (.changed, [:])
        }
    }

    func removeSeasonRecord(_ deed: SeasonDeed, on day: DayKey) throws -> RecordChange {
        try change(day) { rows in
            guard let row = try rows.season(day.number, deed) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }
}
