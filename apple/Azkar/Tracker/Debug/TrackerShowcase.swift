#if DEBUG
import AzkarKit
import Foundation

/// Debug builds only: launch arguments that open a part of the tracker, for checking every
/// screen in a simulator without tapping through it.
///
/// - `-AzkarTrackerOpen day:<days back>|missed|trends|qada`
/// - `-AzkarTrackerScroll recent|calendar|trends|fasting|lifetime|export`
enum TrackerShowcase {
    private static func value(of name: String) -> String? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else { return nil }
        return arguments[index + 1]
    }

    static func route(today: DayKey) -> TrackerRoute? {
        guard let open = value(of: "-AzkarTrackerOpen") else { return nil }
        if open == "missed" { return .missed }
        if open == "prayers" { return .area(.prayers) }
        if open == "azkar" { return .area(.azkar) }
        if open == "quran" { return .area(.quran) }
        if open == "fasting" { return .area(.fasting) }
        if open == "ramadan" { return .area(.ramadan) }
        if open.hasPrefix("day:"), let back = Int(open.dropFirst(4)) { return .day(today.adding(days: -back)) }
        return nil
    }

    static var opensQada: Bool { value(of: "-AzkarTrackerOpen") == "qada" }

    static var scrollTarget: String? { value(of: "-AzkarTrackerScroll") }

    /// `-AzkarTrackerExercise`: the edits the day view's controls make, on yesterday: Fajr made
    /// up late, Duha ticked, a voluntary fast broken, then a make-up fast logged the day before.
    static func exerciseIfRequested(_ app: AppEnvironment, today: DayKey) async {
        guard ProcessInfo.processInfo.arguments.contains("-AzkarTrackerExercise") else { return }
        let yesterday = today.adding(days: -1)
        _ = try? await app.records.setPrayer(.fajr, .late, on: yesterday)
        _ = try? await app.records.setSunnah(.duha, done: true, on: yesterday)
        _ = try? await app.records.setFast(.voluntary, .broken, on: yesterday)
        _ = try? await app.records.setFast(.qada, .fasted, on: yesterday.adding(days: -1))
    }
}
#endif
