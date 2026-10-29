import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

/// Ports of the website's azkar/clock.test.ts and today/night.test.ts (branch wip/web-seven-features).
@Suite("The azkar clock and the night")
struct ClockTests {
    /// Asia/Riyadh is UTC+3 all year, so these cannot drift with DST rules.
    static let zone = TimeZone(identifier: "Asia/Riyadh")!

    /// Plausible times for Makkah on 12 October 2026.
    static func makkahDay(without missing: TimeSlot? = nil) -> PrayerDay {
        var times: [TimeSlot: Date] = [
            .fajr: TestPlaces.iso("2026-10-12T01:58:00Z"),
            .sunrise: TestPlaces.iso("2026-10-12T03:15:00Z"),
            .dhuhr: TestPlaces.iso("2026-10-12T09:07:00Z"),
            .asr: TestPlaces.iso("2026-10-12T12:27:00Z"),
            .maghrib: TestPlaces.iso("2026-10-12T14:56:00Z"),
            .isha: TestPlaces.iso("2026-10-12T16:26:00Z"),
        ]
        if let missing { times[missing] = nil }
        return PrayerDay(day: DayKey("2026-10-12")!, timeZone: zone, times: times)
    }

    static func phase(_ iso: String, _ day: PrayerDay? = makkahDay(), zone: TimeZone = zone) -> DayPhase {
        DayPhase(at: TestPlaces.iso(iso), in: zone, prayerDay: day)
    }

    @Test("Still last night until Fajr, morning until Dhuhr, midday until Asr, evening to the end of the day")
    func phasesWithTimes() {
        #expect(Self.phase("2026-10-11T21:05:00Z") == .beforeDawn)
        #expect(Self.phase("2026-10-12T01:57:59Z") == .beforeDawn)
        #expect(Self.phase("2026-10-12T01:58:00Z") == .morning)
        #expect(Self.phase("2026-10-12T09:06:59Z") == .morning)
        #expect(Self.phase("2026-10-12T09:07:00Z") == .midday)
        #expect(Self.phase("2026-10-12T12:26:59Z") == .midday)
        #expect(Self.phase("2026-10-12T12:27:00Z") == .evening)
        #expect(Self.phase("2026-10-12T20:59:00Z") == .evening)
    }

    @Test("Times that belong to another day are ignored: the clock decides")
    func otherDaysTimes() {
        #expect(Self.phase("2026-10-12T21:30:00Z") == .beforeDawn)
        #expect(Self.phase("2026-10-13T07:00:00Z") == .morning)
    }

    @Test("Falls back to the clock when a time could not be computed")
    func fallbackWhenMissing() {
        let broken = Self.makkahDay(without: .fajr)
        #expect(Self.phase("2026-10-12T00:30:00Z", broken) == .beforeDawn)
        #expect(Self.phase("2026-10-12T01:10:00Z", broken) == .morning)
    }

    @Test("Without times, the clock of the given zone splits the day at 4, 12 and 15 o'clock")
    func phasesWithoutTimes() {
        #expect(Self.phase("2026-10-12T01:00:00Z", nil, zone: TimeZone(identifier: "Asia/Tokyo")!) == .morning)
        #expect(Self.phase("2026-10-12T01:00:00Z", nil, zone: .gmt) == .beforeDawn)
        #expect(Self.phase("2026-10-12T01:00:00Z", nil, zone: TimeZone(identifier: "America/New_York")!) == .evening)
        for (clock, phase) in [("03:59", DayPhase.beforeDawn), ("04:00", .morning), ("11:59", .morning), ("12:00", .midday), ("14:59", .midday), ("15:00", .evening)] {
            #expect(Self.phase("2026-10-12T\(clock):00Z", nil, zone: .gmt) == phase, "\(clock)")
        }
    }

    @Test("Recommends the morning azkar in the morning, nothing at midday, the evening azkar through the night")
    func recommendation() {
        #expect(DayPhase.morning.recommendedSession == .morning)
        #expect(DayPhase.midday.recommendedSession == nil)
        #expect(DayPhase.evening.recommendedSession == .evening)
        #expect(DayPhase.beforeDawn.recommendedSession == .evening)
    }

    @Test("Before dawn, evening, bedtime and after-prayer azkar belong to the day before; the morning's never")
    func sessionDay() {
        let today = DayKey("2026-03-01")!
        for session in [AzkarSession.evening, .sleep] + Prayer.allCases.map(AzkarSession.afterPrayer) {
            #expect(DayPhase.beforeDawn.sessionDay(for: session, today: today) == DayKey("2026-02-28")!, "\(session)")
            for phase in [DayPhase.morning, .midday, .evening] {
                #expect(phase.sessionDay(for: session, today: today) == today, "\(session) \(phase)")
            }
        }
        for phase in DayPhase.allCases {
            #expect(phase.sessionDay(for: .morning, today: today) == today)
        }
    }

    /// 13 October in Riyadh, with Fajr at 04:59 local unless told otherwise.
    static func night(fajr: Date? = TestPlaces.iso("2026-10-13T01:59:00Z")) -> PrayerDay {
        let later = TestPlaces.iso("2026-10-13T09:00:00Z")
        var times: [TimeSlot: Date] = [.sunrise: later, .dhuhr: later, .asr: later, .maghrib: later, .isha: later]
        times[.fajr] = fajr
        return PrayerDay(day: DayKey("2026-10-13")!, timeZone: zone, times: times)
    }

    @Test("Before dawn lasts from midnight until the day's own Fajr, early or late")
    func beforeDawn() {
        let day = Self.night()
        #expect(Night.isBeforeDawn(TestPlaces.iso("2026-10-12T21:00:00Z"), in: Self.zone, today: day))
        #expect(Night.isBeforeDawn(TestPlaces.iso("2026-10-13T01:58:59Z"), in: Self.zone, today: day))
        #expect(!Night.isBeforeDawn(TestPlaces.iso("2026-10-13T01:59:00Z"), in: Self.zone, today: day))
        #expect(!Night.isBeforeDawn(TestPlaces.iso("2026-10-13T16:28:00Z"), in: Self.zone, today: day))
        let early = Self.night(fajr: TestPlaces.iso("2026-10-12T23:10:00Z"))
        #expect(!Night.isBeforeDawn(TestPlaces.iso("2026-10-12T23:30:00Z"), in: Self.zone, today: early))
        let late = Self.night(fajr: TestPlaces.iso("2026-10-13T03:30:00Z"))
        #expect(Night.isBeforeDawn(TestPlaces.iso("2026-10-13T02:30:00Z"), in: Self.zone, today: late))
    }

    @Test("Uses 4 am local when Fajr cannot be computed or no timetable is known")
    func beforeDawnFallback() {
        for today in [Self.night(fajr: nil), nil] {
            #expect(Night.isBeforeDawn(TestPlaces.iso("2026-10-13T00:59:00Z"), in: Self.zone, today: today))
            #expect(!Night.isBeforeDawn(TestPlaces.iso("2026-10-13T01:00:00Z"), in: Self.zone, today: today))
            #expect(!Night.isBeforeDawn(TestPlaces.iso("2026-10-13T20:30:00Z"), in: Self.zone, today: today))
        }
    }

    @Test("Files the sunnah prayers of the night under the day before until Fajr, the day's under today")
    func sunnahDay() {
        let today = DayKey("2026-10-13")!
        for sunnah in [SunnahPrayer.witr, .qiyam, .afterIsha] {
            #expect(Night.sunnahDay(sunnah, today: today, beforeDawn: true) == DayKey("2026-10-12")!)
            #expect(Night.sunnahDay(sunnah, today: today, beforeDawn: false) == today)
        }
        for sunnah in [SunnahPrayer.beforeFajr, .duha, .beforeDhuhr, .afterDhuhr, .afterMaghrib] {
            #expect(Night.sunnahDay(sunnah, today: today, beforeDawn: true) == today)
        }
        #expect(Night.sunnahDay(.witr, today: DayKey("2026-03-01")!, beforeDawn: true) == DayKey("2026-02-28")!)
        #expect(Night.sunnahDay(.qiyam, today: DayKey("2027-01-01")!, beforeDawn: true) == DayKey("2026-12-31")!)
    }
}
