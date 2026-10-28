import Foundation

/// What the app publishes for its widgets: the JSON built by `buildWidgetSnapshot` in
/// src/features/widget/snapshot.ts. Change the two together.
struct WidgetSnapshot: Codable, Equatable {
    static let currentVersion = 1

    var version: Int
    /// "en" or "ar": the app's interface language, whatever the phone's.
    var lang: String
    /// Arabic-Indic digits in the widget's own countdown.
    var arabicDigits: Bool
    /// The saved place's zone; nil before a location is set, and `days` is then empty.
    var timeZone: String?
    var name: String
    /// Yesterday, today and the week ahead, in order.
    var days: [Day]
    /// Every text the widgets show, in the app's language. Some keep `{placeholders}` (see `WidgetText`).
    var labels: [String: String]

    struct Day: Codable, Equatable {
        /// The calendar day at the saved place, "YYYY-MM-DD".
        var date: String
        /// The prayers whose time exists that day, in order.
        var prayers: [Prayer]
        /// Logged statuses by prayer: "ontime", "jamaah", "late", "missed" or "excused".
        var log: [String: String]
    }

    struct Prayer: Codable, Equatable {
        /// "fajr", "dhuhr", "asr", "maghrib" or "isha".
        var prayer: String
        /// Epoch milliseconds.
        var at: Double
        /// The time as the app shows it.
        var time: String

        var date: Date { Date(timeIntervalSince1970: at / 1000) }
    }

    func status(date: String, prayer: String) -> String? {
        days.first { $0.date == date }?.log[prayer]
    }

    /// Shows a prayer as logged, if its day is here and nothing is logged for it yet.
    mutating func markLogged(date: String, prayer: String, status: String) {
        guard let index = days.firstIndex(where: { $0.date == date }), days[index].log[prayer] == nil else { return }
        days[index].log[prayer] = status
    }
}

/// A prayer marked on a widget, waiting for the app to record it in the prayer log
/// (`takeWidgetActions` in src/native/widgetBridge.ts).
struct PendingAction: Codable, Equatable {
    var id: String
    var date: String
    var prayer: String
    var status: String
    /// When it was tapped, epoch milliseconds.
    var at: Double

    var dictionary: [String: Any] {
        ["id": id, "date": date, "prayer": prayer, "status": status, "at": at]
    }
}

enum Prayers {
    /// The five obligatory prayers in order. A prayer's index is the last digit of its reminder ids.
    static let all = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
}

/// The app's reminder that a prayer has not been logged yet (src/features/prayer-times/reminders).
enum UnloggedReminder {
    /// Its notification identifier: 1_000_000_000 + YYYYMMDD * 10 + the prayer's index, as text,
    /// since the Local Notifications plugin names each request after its numeric id.
    static func identifier(date: String, prayer: String) -> String? {
        guard let digit = Prayers.all.firstIndex(of: prayer) else { return nil }
        let parts = date.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              (1...12).contains(month), (1...31).contains(day) else { return nil }
        return String(1_000_000_000 + (year * 10_000 + month * 100 + day) * 10 + digit)
    }
}
