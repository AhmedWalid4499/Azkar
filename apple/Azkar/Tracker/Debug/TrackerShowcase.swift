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
        if open == "trends" { return .trends }
        if open.hasPrefix("day:"), let back = Int(open.dropFirst(4)) { return .day(today.adding(days: -back)) }
        return nil
    }

    static var opensQada: Bool { value(of: "-AzkarTrackerOpen") == "qada" }

    static var scrollTarget: String? { value(of: "-AzkarTrackerScroll") }
}
#endif
