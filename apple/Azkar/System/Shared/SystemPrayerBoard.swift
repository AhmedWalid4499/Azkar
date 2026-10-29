import AzkarKit
import Foundation

/// The prayers around one moment at the saved place, with what is logged: what the widgets, the
/// Live Activity, the controls and Siri show and act on. Plain values, computed with the prayer engine.
///
/// Shared by the app and the widget extension.
nonisolated struct SystemPrayerBoard: Sendable {
    /// One of today's five prayers.
    struct Row: Hashable, Sendable, Identifiable {
        let prayer: Prayer
        let day: DayKey
        /// `nil` when the time does not exist that day (polar day or night).
        let at: Date?
        let status: PrayerStatus?

        var id: Prayer { prayer }
        var isLogged: Bool { status != nil }
        /// Its time has come, so it can be ticked off.
        func hasBegun(at now: Date) -> Bool { at.map { $0 <= now } ?? false }
    }

    let now: Date
    let place: PrayerPlace
    let placeName: String
    let today: DayKey
    /// Yesterday to the day after tomorrow, as one chronological list.
    let timeline: PrayerTimeline
    let rows: [Row]
    let next: UpcomingPrayer?
    /// The latest prayer whose time has come.
    let previous: UpcomingPrayer?
    /// The prayer whose time it is, if any (none between sunrise and Dhuhr).
    let current: UpcomingPrayer?
    private let statuses: [DayKey: DayPrayerRecord]
    private let ishaEnds: IshaDeadline

    /// `nil` until a place is saved. `prayers` are the logged prayers by day (only the days around `now` are read).
    init?(settings: SettingsSnapshot, prayers: [DayKey: DayPrayerRecord], now: Date = .now) {
        guard let location = settings.location, let place = PrayerPlace(location) else { return nil }
        self.now = now
        self.place = place
        placeName = location.label
        today = DayKey(now, in: place.timeZone)
        let days = PrayerCalculator.days(from: today.adding(days: -1), count: 4, at: place, config: settings.calculation)
        timeline = PrayerTimeline(days: days)
        statuses = prayers
        ishaEnds = settings.reminders.ishaDeadline
        let todayTimes = days[1]
        rows = Prayer.allCases.map { prayer in
            Row(prayer: prayer, day: todayTimes.day, at: todayTimes[prayer: prayer], status: prayers[todayTimes.day]?.prayers[prayer]?.status)
        }
        next = timeline.next(after: now)
        previous = timeline.entries.last { $0.at <= now }
        current = timeline.current(at: now)
    }

    func status(of prayer: Prayer, on day: DayKey) -> PrayerStatus? {
        statuses[day]?.prayers[prayer]?.status
    }

    /// Whether the next prayer falls on a later calendar day than `now`.
    var nextIsTomorrow: Bool { next.map { $0.day > today } ?? false }

    /// The most recent prayer whose time has come and that is not logged, looking back a day:
    /// what "Log current prayer" ticks off.
    var latestUnlogged: UpcomingPrayer? {
        let since = now.addingTimeInterval(-86_400)
        return timeline.entries.last { $0.at <= now && $0.at > since && status(of: $0.prayer, on: $0.day) == nil }
    }

    /// Whether the time of `entry` is over by `now` (Isha's runs to Fajr): logging it then is a make-up.
    func hasEnded(_ entry: UpcomingPrayer) -> Bool {
        guard let day = timeline.days.first(where: { $0.day == entry.day }) else { return false }
        let nextDay = timeline.days.first { $0.day == entry.day.adding(days: 1) }
        guard let deadline = day.deadline(for: entry.prayer, nextDay: nextDay, ishaEnds: .fajr) else { return false }
        return deadline.endsAt <= now
    }

    /// The most recent occurrence of `prayer` whose time has come (yesterday's before today's has),
    /// else today's: the day a prayer named without one, as by Siri, is filed under.
    func day(for prayer: Prayer) -> DayKey {
        timeline.entries.last { $0.prayer == prayer && $0.at <= now }?.day ?? today
    }

    /// The instants at which what is shown changes: each prayer time ahead and each midnight at the place.
    func changes(until end: Date) -> [Date] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = place.timeZone
        var dates = timeline.entries.map(\.at).filter { $0 > now && $0 <= end }
        var midnight = calendar.startOfDay(for: now)
        while let following = calendar.date(byAdding: .day, value: 1, to: midnight), following <= end {
            dates.append(following)
            midnight = following
        }
        return Array(Set(dates)).sorted()
    }
}

extension RecordStore {
    /// The logged prayers of the days around `now`, for a `SystemPrayerBoard`.
    nonisolated func prayersAround(_ now: Date, in timeZone: TimeZone, back: Int = 2, ahead: Int = 1) async throws -> [DayKey: DayPrayerRecord] {
        let today = DayKey(now, in: timeZone)
        let days = try await days(from: today.adding(days: -back), to: today.adding(days: ahead))
        return Dictionary(uniqueKeysWithValues: days.map { ($0.day, $0.prayer) })
    }
}
