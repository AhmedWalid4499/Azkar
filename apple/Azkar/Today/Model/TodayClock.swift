import Foundation
import Observation

/// The Today screen's sense of "now". It does not tick: it moves only at the moments that change
/// what the screen shows (each prayer time, sunrise, midnight where the place is), when the app
/// comes back to the foreground, and when the system clock or zone changes. Live countdowns are
/// drawn by `Text(timerInterval:)` and never re-render the rest of the screen.
@MainActor
@Observable
final class TodayClock {
    private(set) var now: Date

    /// DEBUG only: seconds added to the real clock, to show the screen at another moment
    /// (launch argument `-TodayNow 2026-03-01T03:30:00+02:00`). Zero in release builds.
    @ObservationIgnored let offset: TimeInterval

    init() {
        #if DEBUG
        offset = TodayDebugLaunch.clockOffset
        #else
        offset = 0
        #endif
        now = Date().addingTimeInterval(offset)
    }

    /// Reads the clock again. Changes `now` only when the minute moved, so a foreground
    /// event a second later does not redraw anything.
    func refresh() {
        let fresh = Date().addingTimeInterval(offset)
        if abs(fresh.timeIntervalSince(now)) >= 1 { now = fresh }
    }

    /// The real instant `Text(timerInterval:)` must count to, for a moment on this clock.
    func realDate(for moment: Date) -> Date { moment.addingTimeInterval(-offset) }

    /// The real instant now, for the start of a timer range.
    var realNow: Date { Date() }
}
