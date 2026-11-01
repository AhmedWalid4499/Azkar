import ActivityKit
import AzkarKit
import Foundation

/// The "Next prayer" Live Activity: started by the app, updated by it locally (no push).
///
/// Shared by the app (which starts and updates it) and the widget extension (which draws it).
nonisolated struct NextPrayerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable, Sendable {
        var prayer: Prayer
        /// When the prayer's time comes: the countdown runs to it, and the activity is stale after it.
        var at: Date
        /// The prayer time before it, where the progress bar starts.
        var since: Date
        /// It falls on the next calendar day at the place.
        var isTomorrow: Bool
        var language: SystemLanguage
        /// The saved place's zone: times are shown in it.
        var timeZoneID: String
        /// The saved place's name; empty when unknown.
        var placeName: String
        /// The prayer is the Maghrib of a day of Ramadan. Optional so a running activity's older state still reads.
        var isIftar: Bool?
        /// The prayer is Friday's Dhuhr.
        var isJumuah: Bool?

        var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .current }
    }
}

extension NextPrayerAttributes.ContentState {
    /// The state for a board, or `nil` when no next prayer is known.
    nonisolated init?(board: SystemPrayerBoard, language: SystemLanguage, hijriOffset: Int) {
        guard let next = board.next else { return nil }
        let since = board.previous?.at ?? next.at.addingTimeInterval(-6 * 3600)
        self.init(
            prayer: next.prayer, at: next.at, since: min(since, next.at), isTomorrow: board.nextIsTomorrow,
            language: language, timeZoneID: board.place.timeZone.identifier, placeName: board.placeName,
            isIftar: next.prayer == .maghrib && HijriCalendar.isRamadan(next.day, offset: hijriOffset),
            isJumuah: next.prayer == .dhuhr && next.day.isFriday
        )
    }

    /// What the countdown is to: "Iftar" for the Maghrib of a fast, Jumu'ah on Friday, else the prayer.
    nonisolated var title: String {
        if isIftar == true { return SystemText.string("Iftar", language) }
        return isJumuah == true ? SystemText.string("Jumu’ah", language) : SystemText.prayer(prayer, language)
    }
}
