#if DEBUG
import AzkarKit
import Foundation

/// Debug builds only: launch arguments that open a part of the tracker, for checking every
/// screen in a simulator without tapping through it.
///
/// - `-AzkarTrackerOpen day:<days back>|missed|trends|qada|giving|give|duas|dua|owed`
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
        if open == "giving" || open == "give" { return .area(.giving) }
        if open == "duas" || open == "dua" { return .area(.duas) }
        if open == "owed" { return .area(.prayers) }
        if open == "year" { return .yearReview }
        if open.hasPrefix("day:"), let back = Int(open.dropFirst(4)) { return .day(today.adding(days: -back)) }
        return nil
    }

    static var opensQada: Bool { value(of: "-AzkarTrackerOpen") == "qada" }

    static func opens(_ sheet: String) -> Bool { value(of: "-AzkarTrackerOpen") == sheet }

    static var scrollTarget: String? { value(of: "-AzkarTrackerScroll") }

    /// `-AzkarTrackerExercise`: the edits the day view's controls make, on yesterday: Fajr made
    /// up late, Duha ticked, a voluntary fast broken, then a make-up fast logged the day before.
    static func exerciseIfRequested(_ app: AppEnvironment, today: DayKey) async {
        await exerciseDeedsIfRequested(app, today: today)
        guard ProcessInfo.processInfo.arguments.contains("-AzkarTrackerExercise") else { return }
        let yesterday = today.adding(days: -1)
        _ = try? await app.records.setPrayer(.fajr, .late, on: yesterday)
        _ = try? await app.records.setSunnah(.duha, done: true, on: yesterday)
        _ = try? await app.records.setFast(.voluntary, .broken, on: yesterday)
        _ = try? await app.records.setFast(.qada, .fasted, on: yesterday.adding(days: -1))
    }

    /// `-AzkarTrackerDeeds`: prayers owed and made up, three things given, three duas of which one
    /// is answered, once per install.
    private static func exerciseDeedsIfRequested(_ app: AppEnvironment, today: DayKey) async {
        guard ProcessInfo.processInfo.arguments.contains("-AzkarTrackerDeeds"), app.records.records.duas.isEmpty else { return }
        try? await app.records.setOwedPrayersBefore([.fajr: 354, .dhuhr: 354, .asr: 354, .maghrib: 354, .isha: 354])
        try? await app.records.logMakeup(.fajr, on: today.adding(days: -2))
        try? await app.records.logMakeup(.fajr, on: today)
        try? await app.records.logMakeup(.isha, on: today)
        try? await app.records.logGiving(GivingEntry(kind: .sadaqah, day: today, at: .now, amount: 25, currency: "USD", note: "Food bank"))
        try? await app.records.logGiving(GivingEntry(kind: .sadaqah, day: today.adding(days: -3), at: .now.addingTimeInterval(-3 * 86_400)))
        try? await app.records.logGiving(GivingEntry(kind: .zakat, day: today.adding(days: -1), at: .now.addingTimeInterval(-86_400), amount: Decimal(string: "1250.50"), currency: "EGP"))
        for text in ["Guide my family", "اللهم إني أسألك العفو والعافية", "A good job"] { try? await app.records.addDua(text) }
        let duas = app.records.records.duas
        try? await app.records.logDuasSaid(duas.map(\.id), on: today)
        if let last = duas.last { try? await app.records.logDua(.answered, dua: last.id, on: today) }
    }
}
#endif
