import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

@Suite("Next and current prayer, the day's phase and the before-dawn rule, as on the website")
struct ScheduleParityTests {
    struct Schedule: Decodable {
        let dates: [String]
        let prayers: [String]
        let phases: [String]
        /// [place, date, instant, next, current, phase, beforeDawn, zone offset in minutes]; a prayer as
        /// index * 10 + days from the date + 1.
        let samples: [[Double?]]
    }

    static let schedule: Schedule = try! Fixtures.load("schedule.json")

    /// Zones whose rules Apple's time-zone database (2026c on macOS 27) has changed since the release
    /// Node's ICU carries (2026b): Alberta keeps UTC-6 all year, and Morocco no longer moves to UTC+1.
    /// The phase and the before-dawn rule read the local clock, so where the two databases disagree on
    /// the offset at an instant they rightly disagree too; those samples are left out of that check only.
    static let zonesWithNewerRules: Set<String> = ["America/Edmonton", "Africa/Casablanca"]

    private static func encode(_ entry: UpcomingPrayer?, from day: DayKey) -> Double? {
        entry.map { Double(Prayer.allCases.firstIndex(of: $0.prayer)! * 10 + day.days(to: $0.day) + 1) }
    }

    @Test("At every sampled instant, and on each side of every prayer and sunrise, the same answers")
    func everySampleMatches() {
        let schedule = Self.schedule
        #expect(schedule.prayers == Prayer.allCases.map(\.rawValue))
        #expect(schedule.phases == DayPhase.allCases.map(\.rawValue))
        #expect(schedule.samples.count > 20_000)
        let places = Fixtures.places.map(\.prayerPlace)
        let days = schedule.dates.map(Fixtures.day)
        var schedules: [String: PrayerSchedule] = [:]
        var todays: [String: PrayerDay] = [:]
        var mismatches = Mismatches()
        var skipped = 0
        var skippedZones: Set<String> = []
        for sample in schedule.samples {
            let placeIndex = Int(sample[0]!)
            let place = places[placeIndex]
            let day = days[Int(sample[1]!)]
            let now = Fixtures.date(sample[2]!, from: day)
            let key = "\(placeIndex) \(day)"
            let around = schedules[key] ?? PrayerSchedule(today: day, at: place, config: .default)
            schedules[key] = around

            let calendarDay = DayKey(now, in: place.timeZone)
            let todayKey = "\(placeIndex) \(calendarDay)"
            let today = todays[todayKey] ?? PrayerCalculator.day(calendarDay, at: place, config: .default)
            todays[todayKey] = today

            let name = Fixtures.places[placeIndex].name
            let next = Self.encode(around.next(after: now), from: day)
            if next != sample[3] { mismatches.record("next \(name) \(now): web \(String(describing: sample[3])), native \(String(describing: next))") }
            let current = Self.encode(around.current(at: now), from: day)
            if current != sample[4] { mismatches.record("current \(name) \(now): web \(String(describing: sample[4])), native \(String(describing: current))") }
            let localOffset = Double(place.timeZone.secondsFromGMT(for: now) / 60)
            if localOffset != sample[7] {
                skipped += 1
                skippedZones.insert(Fixtures.places[placeIndex].timeZone)
                continue
            }
            let phase = Double(DayPhase.allCases.firstIndex(of: DayPhase(at: now, in: place.timeZone, prayerDay: today))!)
            if phase != sample[5] { mismatches.record("phase \(name) \(now): web \(String(describing: sample[5])), native \(phase)") }
            let beforeDawn: Double = Night.isBeforeDawn(now, in: place.timeZone, today: today) ? 1 : 0
            if beforeDawn != sample[6] { mismatches.record("beforeDawn \(name) \(now): web \(String(describing: sample[6])), native \(beforeDawn)") }
        }
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
        #expect(skippedZones.isSubset(of: Self.zonesWithNewerRules), "the time-zone databases disagree about \(skippedZones)")
        #expect(skipped * 20 < schedule.samples.count, "\(skipped) of \(schedule.samples.count) samples left out")
    }
}
