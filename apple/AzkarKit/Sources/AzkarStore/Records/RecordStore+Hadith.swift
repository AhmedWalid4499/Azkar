import AzkarCore
import Foundation

// The Riyad as-Salihin hadith of the day: opening it notes the day and the hadith's number, kept
// for good, in a `TallyRow` of kind `hadithRead` keyed by the day (no schema change). The native
// app's own: the website has none.

extension RecordStore {
    /// Notes that hadith `number` was read as the hadith of the day on `day`. A day already noted
    /// keeps its first hadith; a number below 1 is no hadith. A day that has not begun cannot be logged.
    public func logHadithRead(_ number: Int, on day: DayKey, at now: Date = .now) throws {
        _ = try changeHadithRead(number, on: day, at: now)
    }

    func changeHadithRead(_ number: Int, on day: DayKey, at now: Date = .now) throws -> RecordChange {
        let today = today(at: now)
        return try change(day) { rows in
            guard number > 0, try rows.value(TallyKind.hadithRead, day.description) == 0 else { return (.unchanged, [:]) }
            if day > today { return (.refusedFutureDay, [:]) }
            try rows.setValue(TallyKind.hadithRead, day.description, number)
            return (.changed, [:])
        }
    }
}
