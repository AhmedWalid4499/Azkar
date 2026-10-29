import AzkarKit
import Observation

/// A screen of the Azkar tab beyond the session picker.
enum ReadingDestination: Hashable {
    /// The reader of one session, filed under `day`; `nil` for the day the clock files the
    /// session under when it opens (`DayPhase.sessionDay`: before Fajr, night sessions belong to
    /// the previous day).
    case session(AzkarSession, day: DayKey?)
    /// The tasbih counter.
    case tasbih
}

/// The Azkar tab's navigation, for opening a session from elsewhere in the app (the Today
/// screen, a notification, a widget's deep link, an App Intent).
///
/// ```swift
/// // Select the Azkar tab, then:
/// ReadingRouter.shared.open(.morning)                                // today's reading
/// ReadingRouter.shared.open(.afterPrayer(.fajr), day: request.day)   // a given day's
/// ReadingRouter.shared.openTasbih()
/// ```
///
/// `ReadingScreen` shows `ReadingRouter.shared` unless it is given another router. Opening
/// replaces whatever the tab was showing with the picker and that one screen above it, so Back
/// returns to the picker. The reader resumes at the first unfinished dhikr, or shows the
/// completion screen when every dhikr of that day's reading is done. A session the dataset has
/// no azkar for shows an empty state.
@MainActor
@Observable
final class ReadingRouter {
    static let shared = ReadingRouter()

    /// The screens above the picker, bound to the tab's `NavigationStack`.
    var path: [ReadingDestination] = []

    init() {}

    /// Opens the reader of `session`, counting on `day` (`nil`: the day the clock gives it now).
    func open(_ session: AzkarSession, day: DayKey? = nil) {
        path = [.session(session, day: day)]
    }

    func openTasbih() {
        path = [.tasbih]
    }

    /// Back to the session picker.
    func showPicker() {
        path = []
    }
}
