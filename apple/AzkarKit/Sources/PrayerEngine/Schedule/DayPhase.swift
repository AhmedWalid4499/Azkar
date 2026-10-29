import AzkarCore
import Foundation

/// The part of the day, as far as the azkar are concerned: a port of the website's
/// src/features/azkar/clock.ts (with afterPrayer.ts of branch wip/web-seven-features) and
/// src/features/today/night.ts. Raw values are the website's.
public enum DayPhase: String, CaseIterable, Codable, Sendable {
    /// Midnight until Fajr: still last night.
    case beforeDawn
    /// Fajr until Dhuhr.
    case morning
    /// Dhuhr until Asr.
    case midday
    /// Asr until midnight.
    case evening
}

extension DayPhase {
    /// Stand-ins for Fajr, Dhuhr and Asr (local hour) when the day's times are not known.
    static let fallbackHour = (fajr: 4, dhuhr: 12, asr: 15)

    /// The phase at `now` in `timeZone`. Uses the day's real times when they are known and belong to
    /// the calendar day `now` falls on; otherwise, and when Fajr, Dhuhr or Asr could not be computed
    /// (extreme latitudes), fixed clock hours.
    public init(at now: Date, in timeZone: TimeZone, prayerDay: PrayerDay?) {
        if let day = prayerDay, day.day == DayKey(now, in: timeZone),
           let fajr = day[.fajr], let dhuhr = day[.dhuhr], let asr = day[.asr] {
            self = now < fajr ? .beforeDawn : now < dhuhr ? .morning : now < asr ? .midday : .evening
            return
        }
        let hour = Self.hour(of: now, in: timeZone)
        let fallback = Self.fallbackHour
        self = hour < fallback.fajr ? .beforeDawn : hour < fallback.dhuhr ? .morning : hour < fallback.asr ? .midday : .evening
    }

    static func hour(of now: Date, in timeZone: TimeZone) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar.component(.hour, from: now)
    }

    /// The session the clock recommends: the morning azkar from Fajr until around Dhuhr, the evening
    /// azkar from Asr until the night ends at the next Fajr, nothing between Dhuhr and Asr. Bedtime
    /// azkar are never recommended by the clock; people sleep at very different hours.
    public var recommendedSession: AzkarSession? {
        switch self {
        case .morning: .morning
        case .midday: nil
        case .evening, .beforeDawn: .evening
        }
    }

    /// The day a session's reading is filed under. The night does not end at midnight: evening,
    /// bedtime and after-prayer azkar read before Fajr belong to the day before (Isha prayed at 1 am
    /// is the evening's, and none of today's prayers has come yet), so they continue that day's
    /// session instead of using up the coming one. The morning session follows the calendar day.
    public func sessionDay(for session: AzkarSession, today: DayKey) -> DayKey {
        session != .morning && self == .beforeDawn ? today.adding(days: -1) : today
    }
}

/// The night, for filing what is done after midnight.
public enum Night {
    /// Stand-in for Fajr (local hour) on days it cannot be computed, as near the poles in summer.
    static let fallbackFajrHour = 4

    /// Whether `now` still belongs to last night: past midnight and not yet Fajr. `today` is the
    /// timetable of the calendar day `now` falls on in `timeZone`.
    public static func isBeforeDawn(_ now: Date, in timeZone: TimeZone, today: PrayerDay?) -> Bool {
        if let fajr = today?[.fajr] { return now < fajr }
        return DayPhase.hour(of: now, in: timeZone) < fallbackFajrHour
    }

    /// The day a sunnah prayer ticked now is filed under. The prayers of the night (the two after Isha,
    /// the night prayer and Witr) belong to the day whose Isha opened that night, so until Fajr they
    /// still count for the day before, just like last night's Isha.
    public static func sunnahDay(_ sunnah: SunnahPrayer, today: DayKey, beforeDawn: Bool) -> DayKey {
        beforeDawn && sunnah.isNightPrayer ? today.adding(days: -1) : today
    }
}
