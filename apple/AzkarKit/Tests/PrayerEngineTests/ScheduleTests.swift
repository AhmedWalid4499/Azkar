import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

/// A port of the website's engine/schedule.test.ts.
@Suite("Next and current prayer")
struct ScheduleTests {
    static let cairo = TestPlaces.cairo
    static let schedule = PrayerSchedule(today: DayKey("2026-10-12")!, at: cairo, config: .default)
    static var today: PrayerDay { schedule.todayTimes }

    static func at(_ clock: String, _ day: String = "2026-10-12") -> Date { TestPlaces.instant(day, clock, cairo.timeZone) }
    static func next(_ now: Date) -> String? { schedule.next(after: now)?.brief }
    static func current(_ now: Date) -> String? { schedule.current(at: now)?.brief }

    @Test("The next prayer is today's Fajr in the small hours")
    func fajrInTheSmallHours() {
        #expect(Self.next(Self.at("00:00")) == "fajr 2026-10-12")
        #expect(Self.next(Self.at("03:30")) == "fajr 2026-10-12")
        #expect(Self.schedule.next(after: Self.at("03:30"))?.at == Self.today[.fajr])
    }

    @Test("Sunrise is never the next prayer, nor in the timeline")
    func neverSunrise() throws {
        let fajr = try #require(Self.today[.fajr]), sunrise = try #require(Self.today[.sunrise])
        #expect(Self.next(fajr.addingTimeInterval(60)) == "dhuhr 2026-10-12")
        #expect(Self.next(sunrise.addingTimeInterval(60)) == "dhuhr 2026-10-12")
        #expect(Self.schedule.timeline.entries.count == 15)
    }

    @Test("Moves on at the very instant a prayer begins")
    func movesOnAtTheInstant() throws {
        let maghrib = try #require(Self.today[.maghrib])
        #expect(Self.next(maghrib.addingTimeInterval(-0.001)) == "maghrib 2026-10-12")
        #expect(Self.next(maghrib) == "isha 2026-10-12")
    }

    @Test("Rolls over to tomorrow's Fajr after Isha, and keeps it across midnight")
    func rollsOverAfterIsha() throws {
        let isha = try #require(Self.today[.isha])
        #expect(Self.next(isha.addingTimeInterval(-0.001)) == "isha 2026-10-12")
        for now in [isha, Self.at("23:59:59"), Self.at("00:00", "2026-10-13"), Self.at("02:00", "2026-10-13")] {
            #expect(Self.next(now) == "fajr 2026-10-13")
            #expect(Self.schedule.next(after: now)?.at == Self.schedule.days[2][.fajr])
        }
    }

    @Test("There is no next prayer once the known days are used up")
    func usedUp() {
        #expect(Self.next(Self.at("23:00", "2026-10-13")) == nil)
        #expect(PrayerTimeline(days: []).next(after: Self.at("12:00")) == nil)
    }

    @Test("The current prayer is last night's Isha until Fajr")
    func lastNightsIsha() {
        #expect(Self.current(Self.at("02:00")) == "isha 2026-10-11")
    }

    @Test("Fajr is current only until sunrise, then nothing until Dhuhr")
    func fajrUntilSunrise() throws {
        let today = Self.today
        #expect(Self.current(try #require(today[.fajr])) == "fajr 2026-10-12")
        #expect(Self.current(try #require(today[.sunrise]).addingTimeInterval(-0.001)) == "fajr 2026-10-12")
        #expect(Self.current(try #require(today[.sunrise])) == nil)
        #expect(Self.current(Self.at("09:00")) == nil)
        #expect(Self.current(try #require(today[.dhuhr])) == "dhuhr 2026-10-12")
    }

    @Test("The current prayer follows the afternoon and evening")
    func afternoonAndEvening() throws {
        let today = Self.today
        #expect(Self.current(Self.at("15:00")) == "dhuhr 2026-10-12")
        #expect(Self.current(try #require(today[.asr]).addingTimeInterval(0.001)) == "asr 2026-10-12")
        #expect(Self.current(try #require(today[.maghrib]).addingTimeInterval(0.001)) == "maghrib 2026-10-12")
        #expect(Self.current(Self.at("23:30")) == "isha 2026-10-12")
    }

    @Test("There is no current prayer before the first known time")
    func beforeTheFirstTime() {
        #expect(Self.current(Self.at("00:30", "2026-10-11")) == nil)
    }

    @Test("The timeline is chronological whatever order the days arrive in")
    func chronological() {
        let days = Self.schedule.days
        let shuffled = PrayerTimeline(days: [days[2], days[0], days[1]])
        #expect(shuffled.entries.map(\.brief) == Self.schedule.timeline.entries.map(\.brief))
        let instants = Self.schedule.timeline.entries.map(\.at)
        #expect(instants == instants.sorted())
    }

    @Test("Still finds yesterday's Isha when it falls after midnight (Reykjavik at the solstice)")
    func yesterdaysIshaAfterMidnight() {
        let place = TestPlaces.reykjavik
        let config = CalculationConfig(method: .fixed(.muslimWorldLeague), highLatitudeRule: .fixed(.seventhOfTheNight))
        let north = PrayerSchedule(today: DayKey("2026-06-22")!, at: place, config: config)
        let now = TestPlaces.instant("2026-06-22", "00:10", place.timeZone)
        #expect(north.next(after: now)?.brief == "isha 2026-06-21")
        #expect(north.current(at: now)?.brief == "maghrib 2026-06-21")
        #expect(north.next(after: TestPlaces.instant("2026-06-22", "01:30", place.timeZone))?.brief == "fajr 2026-06-22")
    }

    @Test("Skips times that do not exist and claims no current prayer on such a day (Tromsø, midnight sun)")
    func polarGaps() {
        let place = TestPlaces.tromso
        let polar = PrayerSchedule(today: DayKey("2026-06-21")!, at: place, config: CalculationConfig(method: .fixed(.muslimWorldLeague)))
        #expect(Set(polar.timeline.entries.map(\.prayer)) == [.dhuhr, .asr])
        #expect(polar.todayTimes.hasMissingTimes)
        #expect(polar.todayTimes[.fajr] == nil && polar.todayTimes[.sunrise] == nil)
        let evening = TestPlaces.instant("2026-06-21", "22:00", place.timeZone)
        #expect(polar.next(after: evening)?.brief == "dhuhr 2026-06-22")
        #expect(polar.current(at: evening) == nil)
    }

    @Test("A schedule around an instant takes the calendar day at the place, not the device's")
    func aroundAnInstant() {
        // 23:30 in Cairo on the 12th is already the 13th in Tokyo and still the 12th in New York.
        let now = Self.at("23:30")
        #expect(PrayerSchedule(around: now, at: Self.cairo, config: .default).today == DayKey("2026-10-12")!)
        let tokyo = PrayerPlace(latitude: 35.68, longitude: 139.69, timeZoneIdentifier: "Asia/Tokyo", countryCode: "JP")!
        #expect(PrayerSchedule(around: now, at: tokyo, config: .default).today == DayKey("2026-10-13")!)
    }

    @Test("A timeline over a week holds every prayer of every day, in order, and ordinary days miss nothing")
    func weekTimeline() {
        let days = PrayerCalculator.days(from: DayKey("2026-10-12")!, count: 7, at: Self.cairo, config: .default)
        #expect(days.map(\.day.description) == (12...18).map { "2026-10-\($0)" })
        #expect(days.allSatisfy { !$0.hasMissingTimes && $0.timeZone == Self.cairo.timeZone })
        let timeline = PrayerTimeline(days: days)
        #expect(timeline.entries.count == 35)
        #expect(timeline.entries.map(\.at) == timeline.entries.map(\.at).sorted())
        #expect(PrayerCalculator.days(from: DayKey("2026-10-12")!, count: 0, at: Self.cairo, config: .default).isEmpty)
    }
}
