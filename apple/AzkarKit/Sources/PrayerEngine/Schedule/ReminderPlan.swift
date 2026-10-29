import AzkarCore
import Foundation

/// The reminders the user asked for. A port of the website's reminders/plan.ts and unlogged.ts
/// (branch wip/web-seven-features); the wording of each notification is the app's.
public struct ReminderChoices: Sendable {
    /// A reminder at each of the five prayer times.
    public var prayers: Bool
    /// The morning azkar, at Fajr or after sunrise (`morningAt`).
    public var morning: Bool
    /// The evening azkar, at Asr.
    public var evening: Bool
    public var morningAt: MorningReminderTime
    /// The "not logged yet" reminders; none when `nil`.
    public var unlogged: UnloggedChoices?

    public init(prayers: Bool, morning: Bool, evening: Bool, morningAt: MorningReminderTime, unlogged: UnloggedChoices? = nil) {
        self.prayers = prayers
        self.morning = morning
        self.evening = evening
        self.morningAt = morningAt
        self.unlogged = unlogged
    }
}

/// "You haven't logged this prayer yet", shortly before its time ends.
public struct UnloggedChoices: Sendable {
    /// The lead times Settings offers, in minutes.
    public static let leadMinutesChoices = [10, 15, 30, 45, 60]

    /// How long before the prayer's time ends the reminder comes.
    public var leadMinutes: Int
    public var ishaEnds: IshaDeadline
    /// Whether a prayer of a day has been logged, whatever its status.
    public var isLogged: @Sendable (DayKey, Prayer) -> Bool

    public init(leadMinutes: Int, ishaEnds: IshaDeadline, isLogged: @escaping @Sendable (DayKey, Prayer) -> Bool) {
        self.leadMinutes = leadMinutes
        self.ishaEnds = ishaEnds
        self.isLogged = isLogged
    }

    /// With the prayers already logged, by day (any status counts), as read from the records.
    public init(leadMinutes: Int, ishaEnds: IshaDeadline, logged: [DayKey: Set<Prayer>]) {
        self.init(leadMinutes: leadMinutes, ishaEnds: ishaEnds) { day, prayer in logged[day]?.contains(prayer) ?? false }
    }
}

/// One notification to schedule.
public struct ReminderEntry: Hashable, Sendable {
    public enum Kind: Hashable, Sendable {
        /// The prayer's time has come.
        case prayer(Prayer)
        /// Read the morning or evening azkar; `after` is the time it follows (Fajr, sunrise or Asr).
        case azkar(AzkarSession, after: TimeSlot)
        /// The prayer is not logged yet and its time ends at `deadline`.
        case unlogged(Prayer, deadline: PrayerDeadline)
    }

    public let kind: Kind
    /// The calendar day the reminder belongs to.
    public let day: DayKey
    public let at: Date
    /// Stable per reminder, such as "2026-10-12-asr", "2026-10-12-morning" or "2026-10-12-asr-unlogged".
    public let key: String

    /// The system notification id: the same for the same reminder however often it is scheduled.
    public var id: Int {
        switch kind {
        case let .prayer(prayer): ReminderPlan.reminderID(day: day, digit: ReminderPlan.digit(prayer))
        case let .azkar(session, _): ReminderPlan.reminderID(day: day, digit: session == .morning ? 5 : 6)
        case let .unlogged(prayer, _): ReminderPlan.unloggedReminderID(day: day, prayer: prayer)
        }
    }

    /// At the same instant: prayers first, then "not logged yet", then azkar.
    var rank: Int {
        switch kind {
        case .prayer: 0
        case .unlogged: 1
        case .azkar: 2
        }
    }
}

public enum ReminderPlan {
    /// How far ahead the app schedules: renewed each time it opens.
    public static let windowDays = 7
    /// iOS keeps the 64 soonest pending notifications of an app and drops the rest. Prayer, "not logged
    /// yet" and azkar reminders together never take more than this, which leaves room for other features.
    public static let reminderLimit = 50
    /// Added to the "not logged yet" reminders' ids, which otherwise follow the prayers' own.
    public static let unloggedIDBase = 1_000_000_000

    private static let minuteMs = 60_000.0

    /// Every reminder the choices ask for on `days`, soonest first and, at the same instant, by kind.
    /// A time that does not exist that day is left out. Isha's "not logged yet" reminder needs the next day in `days`.
    public static func entries(days: [PrayerDay], choices: ReminderChoices) -> [ReminderEntry] {
        var entries: [ReminderEntry] = []
        for day in days {
            if choices.prayers {
                for prayer in Prayer.allCases {
                    if let at = day[prayer: prayer] {
                        entries.append(ReminderEntry(kind: .prayer(prayer), day: day.day, at: at, key: "\(day.day)-\(prayer.rawValue)"))
                    }
                }
            }
            var azkar: [(AzkarSession, TimeSlot)] = []
            if choices.morning { azkar.append((.morning, choices.morningAt == .sunrise ? .sunrise : .fajr)) }
            if choices.evening { azkar.append((.evening, .asr)) }
            for (session, after) in azkar {
                if let at = day[after] {
                    entries.append(ReminderEntry(kind: .azkar(session, after: after), day: day.day, at: at, key: "\(day.day)-\(session)"))
                }
            }
        }
        if let unlogged = choices.unlogged { entries += unloggedEntries(days: days, choices: unlogged) }
        // Stable, as JavaScript's sort is.
        return entries.enumerated().sorted { lhs, rhs in
            if lhs.element.at != rhs.element.at { return lhs.element.at < rhs.element.at }
            if lhs.element.rank != rhs.element.rank { return lhs.element.rank < rhs.element.rank }
            return lhs.offset < rhs.offset
        }.map(\.element)
    }

    /// The "not logged yet" reminders of `days`, unsorted: one `leadMinutes` before the end of each
    /// prayer's time, for every prayer not logged. A prayer whose time or end does not exist that day
    /// is left out, and so is one whose reminder would come before the prayer has even begun.
    public static func unloggedEntries(days: [PrayerDay], choices: UnloggedChoices) -> [ReminderEntry] {
        var byDay: [DayKey: PrayerDay] = [:]
        for day in days { byDay[day.day] = day }
        var entries: [ReminderEntry] = []
        for day in days {
            for prayer in Prayer.allCases {
                guard let start = day[prayer: prayer], !choices.isLogged(day.day, prayer),
                      let deadline = day.deadline(for: prayer, nextDay: byDay[day.day.adding(days: 1)], ishaEnds: choices.ishaEnds)
                else { continue }
                let at = JS.instant(deadline.endsAt) - Double(choices.leadMinutes) * minuteMs
                guard at > JS.instant(start) else { continue }
                entries.append(ReminderEntry(
                    kind: .unlogged(prayer, deadline: deadline),
                    day: day.day,
                    at: Date(timeIntervalSince1970: at / 1000),
                    key: "\(day.day)-\(prayer.rawValue)-unlogged"
                ))
            }
        }
        return entries
    }

    /// What the app hands to the system: the reminders after `now` and within the next `windowDays`
    /// days, the first `reminderLimit` of them. `dayFor` gives the prayer times of a day at the saved place.
    public static func upcoming(
        dayFor: (DayKey) -> PrayerDay,
        timeZone: TimeZone,
        choices: ReminderChoices,
        now: Date
    ) -> [ReminderEntry] {
        let today = DayKey(now, in: timeZone)
        // From yesterday: at high latitudes its Isha can fall after midnight, and the end of its time
        // does anyway. To the day after the window: the last day's Isha ends on it.
        let days = (0..<(windowDays + 3)).map { dayFor(today.adding(days: $0 - 1)) }
        let until = now.addingTimeInterval(TimeInterval(windowDays * 86_400))
        return Array(entries(days: days, choices: choices).filter { $0.at > now && $0.at <= until }.prefix(reminderLimit))
    }

    static func digit(_ prayer: Prayer) -> Int {
        switch prayer {
        case .fajr: 0
        case .dhuhr: 1
        case .asr: 2
        case .maghrib: 3
        case .isha: 4
        }
    }

    static func dayNumber(_ day: DayKey) -> Int { day.year * 10_000 + day.month * 100 + day.day }

    static func reminderID(day: DayKey, digit: Int) -> Int { dayNumber(day) * 10 + digit }

    /// The id of the "not logged yet" reminder of one prayer of one day: 1_000_000_000 + YYYYMMDD * 10
    /// + 0 to 4 for Fajr to Isha, so Asr on 12 October 2026 is 1202610122. The widget cancels a pending
    /// one by this id when the prayer is ticked off there: the formula must never change.
    public static func unloggedReminderID(day: DayKey, prayer: Prayer) -> Int {
        unloggedIDBase + reminderID(day: day, digit: digit(prayer))
    }
}
