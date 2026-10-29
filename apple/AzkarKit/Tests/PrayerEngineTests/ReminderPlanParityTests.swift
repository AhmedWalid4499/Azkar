import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

/// The website's reminder plan (reminders/plan.ts and unlogged.ts of branch wip/web-seven-features),
/// run by scripts/native/engine/generate.fixtures.ts, against this one.
@Suite("Reminder plan, as on the website")
struct ReminderPlanParityTests {
    struct Choices: Decodable {
        struct Unlogged: Decodable {
            let leadMinutes: Int
            let ishaEnds: String
        }

        let prayers: Bool
        let morning: Bool
        let evening: Bool
        let morningAt: String
        let unlogged: Unlogged?
    }

    struct Case: Decodable {
        let place: Int
        let date: Int
        let choices: Int
        /// [key, at, id, after or endsAt, preferred]
        let entries: [[FixtureValue]]
    }

    struct UpcomingCase: Decodable {
        let place: Int
        let date: Int
        let hours: Double
        let choices: Int
        /// [key, at]
        let entries: [[FixtureValue]]
    }

    struct File: Decodable {
        let windowDays: Int
        let limit: Int
        let dates: [String]
        let choices: [Choices]
        let entries: [Case]
        let upcoming: [UpcomingCase]
    }

    static let file: File = try! Fixtures.load("reminders.json")

    /// The generator's `isLoggedRule`: logged when the day's distance from the case's date plus the
    /// prayer's index is a multiple of three.
    static func choices(_ index: Int, base: DayKey) -> ReminderChoices {
        let web = file.choices[index]
        let unlogged = web.unlogged.map {
            UnloggedChoices(leadMinutes: $0.leadMinutes, ishaEnds: IshaDeadline(rawValue: $0.ishaEnds)!) { day, prayer in
                let value = base.days(to: day) + Prayer.allCases.firstIndex(of: prayer)!
                return ((value % 3) + 3) % 3 == 0
            }
        }
        return ReminderChoices(
            prayers: web.prayers, morning: web.morning, evening: web.evening,
            morningAt: MorningReminderTime(rawValue: web.morningAt)!, unlogged: unlogged
        )
    }

    static func encode(_ entry: ReminderEntry, from day: DayKey) -> [FixtureValue] {
        var row: [FixtureValue] = [.text(entry.key), FixtureValue(Fixtures.offset(entry.at, from: day)), .number(Double(entry.id))]
        switch entry.kind {
        case .prayer: row += [.null, .null]
        case let .azkar(_, after): row += [.text(after.rawValue), .null]
        case let .unlogged(_, deadline): row += [FixtureValue(Fixtures.offset(deadline.endsAt, from: day)), .number(deadline.preferred ? 1 : 0)]
        }
        return row
    }

    @Test("The window and the limit are the website's")
    func constants() {
        #expect(ReminderPlan.windowDays == Self.file.windowDays)
        #expect(ReminderPlan.reminderLimit == Self.file.limit)
    }

    @Test("Every reminder of four days, in the same order, at the same instant, with the same id")
    func everyEntryMatches() {
        let file = Self.file
        #expect(file.entries.count > 400)
        let places = Fixtures.places.map(\.prayerPlace)
        var mismatches = Mismatches()
        for testCase in file.entries {
            let place = places[testCase.place]
            let base = Fixtures.day(file.dates[testCase.date])
            let days = PrayerCalculator.days(from: base.adding(days: -1), count: 4, at: place, config: .default)
            let entries = ReminderPlan.entries(days: days, choices: Self.choices(testCase.choices, base: base)).map { Self.encode($0, from: base) }
            if entries != testCase.entries {
                let index = zip(entries, testCase.entries).enumerated().first { $0.element.0 != $0.element.1 }?.offset ?? min(entries.count, testCase.entries.count)
                mismatches.record("\(Fixtures.places[testCase.place].name) \(base) choices \(testCase.choices), entry \(index) of \(testCase.entries.count)/\(entries.count): web \(testCase.entries.dropFirst(index).first ?? []), native \(entries.dropFirst(index).first ?? [])")
            }
        }
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
    }

    @Test("What is handed to the system at sampled instants: after now, within the week, the first fifty")
    func upcomingMatches() {
        let file = Self.file
        #expect(file.upcoming.contains { $0.entries.count == file.limit })
        let places = Fixtures.places.map(\.prayerPlace)
        var mismatches = Mismatches()
        for testCase in file.upcoming {
            let place = places[testCase.place]
            let base = Fixtures.day(file.dates[testCase.date])
            let now = Fixtures.date(testCase.hours * 3_600_000, from: base)
            let upcoming = ReminderPlan.upcoming(
                dayFor: { PrayerCalculator.day($0, at: place, config: .default) },
                timeZone: place.timeZone,
                choices: Self.choices(testCase.choices, base: base),
                now: now
            ).map { [FixtureValue.text($0.key), FixtureValue(Fixtures.offset($0.at, from: base))] }
            if upcoming != testCase.entries {
                mismatches.record("\(Fixtures.places[testCase.place].name) \(now) choices \(testCase.choices): web \(testCase.entries.count) entries, native \(upcoming.count); first web \(testCase.entries.first ?? []), native \(upcoming.first ?? [])")
            }
        }
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
    }

    @Test("Notification ids follow the website's formula, which the widget relies on")
    func ids() {
        let day = DayKey("2026-10-12")!
        #expect(ReminderPlan.unloggedReminderID(day: day, prayer: .asr) == 1_202_610_122)
        let asr = ReminderEntry(kind: .prayer(.asr), day: day, at: .now, key: "2026-10-12-asr")
        #expect(asr.id == 202_610_122)
        let evening = ReminderEntry(kind: .azkar(.evening, after: .asr), day: day, at: .now, key: "2026-10-12-evening")
        #expect(evening.id == 202_610_126)
        // Inside a 32-bit integer for every day a DayKey can name.
        #expect(Int32(exactly: ReminderPlan.unloggedReminderID(day: DayKey("9999-12-31")!, prayer: .isha)) != nil)
    }

    @Test("The logged prayers can be handed over as a value, read from the records beforehand")
    func loggedAsAValue() {
        let day = DayKey("2026-10-12")!
        let choices = UnloggedChoices(leadMinutes: 15, ishaEnds: .middle, logged: [day: [.fajr, .isha]])
        #expect(choices.isLogged(day, .fajr))
        #expect(choices.isLogged(day, .isha))
        #expect(!choices.isLogged(day, .asr))
        #expect(!choices.isLogged(day.adding(days: 1), .fajr))
    }
}
