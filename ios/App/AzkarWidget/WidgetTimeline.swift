import Foundation

/// One prayer as a widget shows it.
struct PrayerSlot: Equatable, Identifiable {
    let prayer: String
    /// The calendar day it belongs to at the saved place.
    let date: String
    let at: Date
    let time: String
    /// Its logged status, or nil when it is not logged.
    let status: String?

    var id: String { "\(date)-\(prayer)" }
}

/// What a widget shows at one moment.
enum WidgetContent: Equatable {
    /// The app has not published anything yet.
    case notSetUp
    /// The app has no location yet.
    case noLocation
    /// The published days are behind: the app has not been opened for a week or so.
    case outOfDate
    case ready(next: PrayerSlot, nextIsTomorrow: Bool, today: [PrayerSlot])

    var isReady: Bool {
        if case .ready = self { return true }
        return false
    }
}

/// Works out, from the snapshot alone, what the widgets show and when that changes.
enum WidgetTimeline {
    static func content(of snapshot: WidgetSnapshot?, at moment: Date) -> WidgetContent {
        guard let snapshot else { return .notSetUp }
        guard let zone = zone(of: snapshot), !snapshot.days.isEmpty else { return .noLocation }
        let todayKey = dateKey(moment, in: zone)
        guard let today = snapshot.days.first(where: { $0.date == todayKey }),
              let next = slots(of: snapshot.days).first(where: { $0.at > moment }) else { return .outOfDate }
        return .ready(next: next, nextIsTomorrow: next.date > todayKey, today: slots(of: [today]))
    }

    /// When the widgets change: now, at each prayer time (the next prayer moves on) and at each
    /// midnight at the saved place (a new day's prayers), as far as the published days go.
    static func entryDates(for snapshot: WidgetSnapshot?, from now: Date) -> [Date] {
        guard let snapshot, let zone = zone(of: snapshot) else { return [now] }
        let prayerTimes = slots(of: snapshot.days).map(\.at)
        let midnights = snapshot.days.compactMap { startOfDay($0.date, in: zone) }
        let changes = Set((prayerTimes + midnights).filter { $0 > now })
        return [now] + changes.sorted()
    }

    /// Every published prayer, in time order: at high latitudes a day's Isha can fall after the next midnight.
    static func slots(of days: [WidgetSnapshot.Day]) -> [PrayerSlot] {
        days.flatMap { day in
            day.prayers.map { PrayerSlot(prayer: $0.prayer, date: day.date, at: $0.date, time: $0.time, status: day.log[$0.prayer]) }
        }
        .sorted { $0.at < $1.at }
    }

    static func zone(of snapshot: WidgetSnapshot) -> TimeZone? {
        snapshot.timeZone.flatMap(TimeZone.init(identifier:))
    }

    /// The calendar day of an instant in a zone, "YYYY-MM-DD".
    static func dateKey(_ date: Date, in zone: TimeZone) -> String {
        let parts = calendar(in: zone).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func startOfDay(_ dateKey: String, in zone: TimeZone) -> Date? {
        let parts = dateKey.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar(in: zone).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    private static func calendar(in zone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar
    }
}
