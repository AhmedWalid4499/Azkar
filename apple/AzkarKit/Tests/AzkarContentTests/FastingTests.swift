import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite("Fasting")
struct FastingTests {
    struct WebFast: Decodable {
        var kind: String
        var status: String
        var at: Double?

        var record: FastRecord { FastRecord(kind: FastKind(rawValue: kind)!, status: FastStatus(rawValue: status)!, loggedAt: at.map(instant)) }
    }

    struct Owed: Decodable, Equatable {
        var fromRamadan, before, madeUp, remaining: Int
    }

    struct Ramadan: Decodable {
        var year: Int
        var days: [String]
        var elapsed, fasted, notFasted, unlogged: Int
        var ongoing: Bool
    }

    struct Stats: Decodable {
        var owed: Owed
        var ramadan: Ramadan?
        var voluntary: VoluntaryCounts?
        var mondayThursday: WebStreak
        var whiteDays: WebStreak
    }

    struct VoluntaryCounts: Decodable {
        var month: Int
        var year: Int
    }

    struct Shawwal: Decodable {
        var key: String
        var count: Int
    }

    struct Result: Decodable {
        var today: String
        var offset: Int
        var stats: Stats
        var owedNoneBefore: Owed
        var shawwal: [Shawwal]
    }

    struct Civil: Decodable {
        var year, month: Int
        var days: [String]
    }

    struct Fixture: Decodable {
        var days: [[AnyCodableOptional]]
        var history: [String: WebFast]
        var results: [Result]
        var civil: [Civil]
    }

    static func load() throws -> Fixture { try Fixtures.load(Fixture.self, "fasting.json") }

    static func owed(_ owed: OwedFasts) -> Owed {
        Owed(fromRamadan: owed.fromRamadan, before: owed.before, madeUp: owed.madeUp, remaining: owed.remaining)
    }

    @Test("Every day from 2025 to 2028 is classified as the web branch classifies it, at every offset")
    func dayInfoParity() throws {
        let fixture = try Self.load()
        #expect(fixture.days.count > 4000)
        for row in fixture.days {
            let key = day(row[0].string!)
            let offset = row[1].int!
            let info = FastingCalendar.info(for: key, offset: offset)
            #expect(info.hijri == HijriDate(year: row[2].int!, month: row[3].int!, day: row[4].int!), "\(key) \(offset)")
            #expect(info.ramadanDay == row[5].int)
            #expect(info.forbidden?.rawValue == row[6].string, "\(key) \(offset)")
            #expect(info.reasons.map(\.rawValue) == row[7].strings, "\(key) \(offset)")
        }
    }

    @Test("Owed days, Ramadan, voluntary counts, Shawwal and the streaks match the web branch", arguments: [0, 1, 2])
    func statsParity(third: Int) throws {
        let fixture = try Self.load()
        let history = Dictionary(uniqueKeysWithValues: fixture.history.map { (day($0.key), $0.value.record) })
        let results = fixture.results.enumerated().filter { $0.offset % 3 == third }.map(\.element)
        for expected in results {
            let today = day(expected.today)
            let context = "\(expected.today) offset \(expected.offset)"
            let stats = FastingStats.statistics(history, today: today, offset: expected.offset, owedBefore: 3)
            #expect(Self.owed(stats.owed) == expected.stats.owed, "\(context)")
            #expect(Self.owed(FastingStats.owed(history, owedBefore: -4)) == expected.owedNoneBefore)
            let ramadan = try #require(expected.stats.ramadan)
            #expect(stats.ramadan.year == ramadan.year, "\(context)")
            #expect(stats.ramadan.days.map(\.description) == ramadan.days, "\(context)")
            #expect(stats.ramadan.elapsed == ramadan.elapsed)
            #expect(stats.ramadan.fasted == ramadan.fasted, "\(context)")
            #expect(stats.ramadan.notFasted == ramadan.notFasted, "\(context)")
            #expect(stats.ramadan.unlogged == ramadan.unlogged)
            #expect(stats.ramadan.ongoing == ramadan.ongoing)
            #expect(stats.voluntary.month == expected.stats.voluntary?.month, "\(context)")
            #expect(stats.voluntary.year == expected.stats.voluntary?.year, "\(context)")
            #expect(stats.mondayThursday == expected.stats.mondayThursday.streak, "\(context)")
            #expect(stats.whiteDays == expected.stats.whiteDays.streak, "\(context)")
            for shawwal in expected.shawwal {
                #expect(FastingStats.shawwalFasts(before: day(shawwal.key), in: history, offset: expected.offset) == shawwal.count, "\(shawwal.key)")
            }
        }
    }

    @Test("A Hijri month's civil days match the web branch's civilDaysOfHijriMonth")
    func civilDaysParity() throws {
        for expected in try Self.load().civil {
            #expect(HijriCalendar.civilDays(ofYear: expected.year, month: expected.month, offset: 1).map(\.description) == expected.days, "\(expected.year)-\(expected.month)")
        }
    }

    // MARK: - The rules themselves

    /// The first civil day of a Hijri month, without offset.
    static func first(_ year: Int, _ month: Int) -> DayKey { HijriCalendar.civilDays(ofYear: year, month: month).first! }

    @Test("Fasting is forbidden on the two Eids and the days of Tashriq, and nothing is recommended then")
    func forbiddenDays() {
        let shawwal = Self.first(1447, 10)
        #expect(FastingCalendar.info(for: shawwal).forbidden == .eidAlFitr)
        let dhulHijjah = Self.first(1447, 12)
        #expect(FastingCalendar.info(for: dhulHijjah.adding(days: 9)).forbidden == .eidAlAdha)
        for tashriq in 10...12 {
            let info = FastingCalendar.info(for: dhulHijjah.adding(days: tashriq))
            #expect(info.forbidden == .tashriq)
            #expect(info.reasons.isEmpty, "the 13th is a white day, but a day of Tashriq")
        }
        #expect(FastingCalendar.info(for: dhulHijjah.adding(days: 13)).forbidden == nil)
        #expect(!FastingCalendar.isWhiteDay(HijriDate(year: 1447, month: 12, day: 13)))
        #expect(FastingCalendar.isWhiteDay(HijriDate(year: 1447, month: 12, day: 14)))
    }

    @Test("Arafah, Ashura with the day before it, Shawwal, the white days, Mondays and Thursdays are recommended")
    func recommendedDays() {
        let dhulHijjah = Self.first(1447, 12)
        #expect(FastingCalendar.info(for: dhulHijjah.adding(days: 8)).reasons.first == .arafah)
        let muharram = Self.first(1448, 1)
        #expect(FastingCalendar.info(for: muharram.adding(days: 9)).reasons.first == .ashura)
        #expect(FastingCalendar.info(for: muharram.adding(days: 8)).reasons.first == .tasua)
        let shawwal = Self.first(1447, 10)
        #expect(FastingCalendar.info(for: shawwal.adding(days: 1)).reasons.contains(.shawwal))
        #expect(FastingCalendar.info(for: shawwal.adding(days: 12)).reasons.contains(.whiteDays))
        // 2026-10-26 is a Monday and 2026-10-29 a Thursday (Jumada I 15 and 18, 1448).
        #expect(FastingCalendar.info(for: day("2026-10-26")).reasons == [.whiteDays, .monday])
        #expect(FastingCalendar.info(for: day("2026-10-29")).reasons == [.thursday])
        #expect(FastingCalendar.info(for: day("2026-10-27")).reasons.isEmpty)
        #expect(FastingCalendar.shawwalFasts == 6)
    }

    @Test("In Ramadan the fast is obligatory: no voluntary reasons are given")
    func ramadanDays() {
        let ramadan = HijriCalendar.civilDays(ofYear: 1447, month: 9)
        for key in ramadan {
            let info = FastingCalendar.info(for: key)
            #expect(info.isRamadan && info.reasons.isEmpty && info.forbidden == nil)
        }
        #expect(FastingCalendar.info(for: ramadan[0]).ramadanDay == 1)
        // With the offset the month moves, and so does its first day.
        #expect(FastingCalendar.info(for: ramadan[0], offset: -1).ramadanDay == nil)
    }

    @Test("Ramadan days owed are those missed, excused or broken, less the make-up fasts kept")
    func owedDays() {
        let ramadan = HijriCalendar.civilDays(ofYear: 1447, month: 9)
        var history: FastingHistory = [:]
        history[ramadan[0]] = FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil)
        history[ramadan[1]] = FastRecord(kind: .ramadan, status: .missed, loggedAt: nil)
        history[ramadan[2]] = FastRecord(kind: .ramadan, status: .excused, loggedAt: nil)
        history[ramadan[3]] = FastRecord(kind: .ramadan, status: .broken, loggedAt: nil)
        history[day("2026-05-04")] = FastRecord(kind: .qada, status: .fasted, loggedAt: nil)
        history[day("2026-05-05")] = FastRecord(kind: .qada, status: .broken, loggedAt: nil)
        #expect(FastingStats.owed(history) == OwedFasts(fromRamadan: 3, before: 0, madeUp: 1, remaining: 2))
        #expect(FastingStats.owed(history, owedBefore: 2).remaining == 4)
        #expect(FastingStats.owed([day("2026-05-04"): FastRecord(kind: .qada, status: .fasted, loggedAt: nil)]).remaining == 0, "never below zero")
        let summary = FastingStats.ramadan(history, today: ramadan[9])
        #expect(summary.ongoing && summary.elapsed == 10 && summary.fasted == 1 && summary.notFasted == 3 && summary.unlogged == 6)
    }

    @Test("An excused Monday neither breaks nor extends the run, and an unlogged today is not held against")
    func mondayThursdayRules() {
        // Mondays and Thursdays of Jumada I 1448: 2026-10-22 Thu, 26 Mon, 29 Thu.
        var history: FastingHistory = [
            day("2026-10-22"): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil),
            day("2026-10-26"): FastRecord(kind: .voluntary, status: .excused, loggedAt: nil),
        ]
        #expect(FastingStats.mondayThursdayStreak(history, today: day("2026-10-29")) == Streak(current: 1, best: 1))
        history[day("2026-10-29")] = FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil)
        #expect(FastingStats.mondayThursdayStreak(history, today: day("2026-10-29")) == Streak(current: 2, best: 2))
        #expect(FastingStats.mondayThursdayStreak(history, today: day("2026-11-03")) == Streak(current: 0, best: 2), "Monday 2 November passed unlogged")
        #expect(FastingStats.mondayThursdayStreak([:], today: day("2026-10-29")) == .none)
    }
}

/// A heterogeneous JSON array element that may be null.
struct AnyCodableOptional: Decodable {
    var string: String?
    var int: Int?
    var strings: [String]?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        string = try? container.decode(String.self)
        int = try? container.decode(Int.self)
        strings = try? container.decode([String].self)
    }
}
