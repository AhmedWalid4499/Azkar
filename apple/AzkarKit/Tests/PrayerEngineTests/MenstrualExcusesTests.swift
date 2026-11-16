import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

@Suite("What menstrual mode excuses")
struct MenstrualExcusesTests {
    static let cairo = TestPlaces.cairo

    static func at(_ clock: String, _ day: String) -> Date { TestPlaces.instant(day, clock, cairo.timeZone) }

    static func timeline(since: Date, now: Date) -> PrayerTimeline {
        PrayerTimeline(days: days(since: since, now: now))
    }

    static func days(since: Date, now: Date) -> [PrayerDay] {
        let first = MenstrualExcuses.firstDay(since: since, now: now, in: cairo.timeZone)
        let last = DayKey(now, in: cairo.timeZone)
        let count = first.days(to: last) + 1
        return PrayerCalculator.days(from: first, count: count, at: cairo, config: .default)
    }

    static func excused(since: Date, now: Date) -> [String] {
        MenstrualExcuses.prayers(since: since, now: now, timeline: timeline(since: since, now: now)).map(\.brief)
    }

    @Test("Turned on during Dhuhr's time: Dhuhr and every prayer that came after it")
    func fromTheRunningPrayer() {
        let since = Self.at("14:00", "2026-10-12"), now = Self.at("10:00", "2026-10-13")
        #expect(Self.excused(since: since, now: now) == ["dhuhr 2026-10-12", "asr 2026-10-12", "maghrib 2026-10-12", "isha 2026-10-12", "fajr 2026-10-13"])
    }

    @Test("Turned on between sunrise and Dhuhr: Fajr's time had ended, so it is not excused")
    func notFajrAfterSunrise() {
        let since = Self.at("09:00", "2026-10-12"), now = Self.at("23:00", "2026-10-12")
        #expect(Self.excused(since: since, now: now) == ["dhuhr 2026-10-12", "asr 2026-10-12", "maghrib 2026-10-12", "isha 2026-10-12"])
    }

    @Test("Turned on after midnight: the evening's Isha is still running and is excused")
    func ishaAfterMidnight() {
        let since = Self.at("02:00", "2026-10-13"), now = Self.at("02:05", "2026-10-13")
        #expect(Self.excused(since: since, now: now) == ["isha 2026-10-12"])
    }

    @Test("A prayer whose time has not come yet is never excused")
    func notAhead() {
        let since = Self.at("14:00", "2026-10-12")
        #expect(Self.excused(since: since, now: since) == ["dhuhr 2026-10-12"])
        #expect(Self.excused(since: since.addingTimeInterval(60), now: since).isEmpty)
    }

    @Test("Looks back at most forty days")
    func fortyDays() throws {
        let now = Self.at("12:00", "2026-10-12"), since = now.addingTimeInterval(-60 * 86_400)
        let prayers = MenstrualExcuses.prayers(since: since, now: now, timeline: Self.timeline(since: since, now: now))
        let first = try #require(prayers.first)
        #expect(first.at >= now.addingTimeInterval(-40 * 86_400))
        #expect(prayers.count >= 39 * 5 && prayers.count <= 41 * 5)
    }

    @Test("A day of Ramadan is excused when the mode was on at any time between its Fajr and Maghrib")
    func ramadanDays() {
        let ramadan: Set<DayKey> = [DayKey("2026-10-12")!, DayKey("2026-10-13")!]
        func days(_ since: Date, _ now: Date) -> [String] {
            MenstrualExcuses.ramadanDays(since: since, now: now, days: Self.days(since: since, now: now)) { ramadan.contains($0) }.map(\.description)
        }
        // On in the afternoon: the day's fast is broken.
        #expect(days(Self.at("14:00", "2026-10-12"), Self.at("15:00", "2026-10-12")) == ["2026-10-12"])
        // On after Maghrib: that day was fasted; the next is excused once its Fajr comes.
        #expect(days(Self.at("20:00", "2026-10-12"), Self.at("23:00", "2026-10-12")).isEmpty)
        #expect(days(Self.at("20:00", "2026-10-12"), Self.at("03:00", "2026-10-13")).isEmpty)
        #expect(days(Self.at("20:00", "2026-10-12"), Self.at("10:00", "2026-10-13")) == ["2026-10-13"])
        // Days outside Ramadan never are.
        #expect(days(Self.at("14:00", "2026-10-12"), Self.at("10:00", "2026-10-14")) == ["2026-10-12", "2026-10-13"])
    }
}
