import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// The prayer log's statistics give exactly what the website's `stats.ts`, `sunnahStats.ts` and
/// `trackerStats.ts` give on the same records (fixtures from `scripts/native/content`).
@Suite("Prayer statistics match the website")
struct PrayerStatsParityTests {
    struct Case: Decodable {
        var name: String
        var entries: [String: [String: String]]
        var loggedAt: [String: [String: Double]]
        var sunnah: [String: [String: Double]]
        var days: [DayCase]
        var recordedDays: [String]
        var results: [Result]

        var history: PrayerHistory { WebData.prayers(entries: entries, loggedAt: loggedAt, sunnah: sunnah) }
    }

    struct Counts: Decodable, Equatable {
        var ontime, jamaah, late, missed, excused: Int

        init(_ counts: StatusCounts) {
            (ontime, jamaah, late, missed, excused) = (counts.ontime, counts.jamaah, counts.late, counts.missed, counts.excused)
        }
    }

    struct Summary: Decodable {
        var counts: Counts
        var logged, prayed, due: Int
        var standing: String
    }

    struct SunnahSummary: Decodable {
        var done, due, rawatib, rawatibRakahs: Int
        var rawatibStanding: String
        var witr: Bool
        var witrStanding: String
    }

    struct DayCase: Decodable {
        var key: String
        var summary: Summary
        var sunnah: SunnahSummary
    }

    struct Rate: Decodable {
        var prayed: Int
        var due: Int
        var percent: Int?
    }

    struct SunnahRate: Decodable {
        var prayed, due, days: Int
        var byPrayer: [String: Int]
    }

    struct Window: Decodable {
        var days: Int
        var prayer: Rate
        var sunnah: SunnahRate
    }

    struct Month: Decodable {
        struct Breakdown: Decodable {
            var elapsedDays, logged: Int
            var byStatus: Counts
            var byPrayer: [String: Counts]
        }

        var year, month: Int
        var breakdown: Breakdown
    }

    struct Missed: Decodable {
        struct Item: Decodable {
            var dateKey: String
            var prayer: String
        }

        var count: Int
        var dates: [String]
        var prayers: [Item]
    }

    struct Lifetime: Decodable {
        var logged, prayed, sunnah: Int
    }

    struct Weeks: Decodable {
        struct Week: Decodable {
            var start: String
            var days: Int
            var current: Bool
            var prayed, sunnah, azkar: Int
        }

        var weekStart: Int
        var totals: [Week]
    }

    struct Result: Decodable {
        var today: String
        var firstLoggedDay: String?
        var streaks: WebStreak
        var rates: [Window]
        var months: [Month]
        var missed: Missed
        var firstSunnahDay: String?
        var witr: WebStreak
        var rawatib: WebStreak
        var lifetime: Lifetime
        var hasAnyRecord: Bool
        var weeks: [Weeks]
    }

    static let cases: [Case] = (try? Fixtures.load([Case].self, "prayer-stats.json")) ?? []

    @Test("The fixtures load and cover several scenarios")
    func fixturesLoad() throws {
        let cases = try Fixtures.load([Case].self, "prayer-stats.json")
        #expect(cases.count >= 6)
    }

    @Test("Each day is summarised as the website summarises it", arguments: cases)
    func daySummaries(_ fixture: Case) {
        let history = fixture.history
        for expected in fixture.days {
            let summary = PrayerStats.summarize(history[day(expected.key)])
            #expect(Counts(summary.counts) == expected.summary.counts, "\(expected.key)")
            #expect(summary.logged == expected.summary.logged)
            #expect(summary.prayed == expected.summary.prayed)
            #expect(summary.due == expected.summary.due)
            #expect(summary.standing.rawValue == expected.summary.standing, "\(fixture.name) \(expected.key)")

            let sunnah = SunnahStats.summarize(history[day(expected.key)])
            #expect(sunnah.done == expected.sunnah.done)
            #expect(sunnah.due == expected.sunnah.due, "\(fixture.name) \(expected.key)")
            #expect(sunnah.rawatib == expected.sunnah.rawatib)
            #expect(sunnah.rawatibRakahs == expected.sunnah.rawatibRakahs)
            #expect(sunnah.rawatibStanding.rawValue == expected.sunnah.rawatibStanding)
            #expect(sunnah.witr == expected.sunnah.witr)
            #expect(sunnah.witrStanding.rawValue == expected.sunnah.witrStanding)
        }
    }

    @Test("Streaks, rates, months, missed prayers and totals match for every today", arguments: cases)
    func measuresUpToToday(_ fixture: Case) {
        let history = fixture.history
        let label = fixture.name
        #expect(TrackerStats.recordedDays(TrackerHistory(prayers: history)).map(\.description) == fixture.recordedDays, "\(label)")
        for expected in fixture.results {
            let today = day(expected.today)
            let context = "\(label) on \(expected.today)"
            #expect(PrayerStats.firstLoggedDay(history, today: today)?.description == expected.firstLoggedDay, "\(context)")
            #expect(PrayerStats.streaks(history, today: today) == expected.streaks.streak, "\(context)")
            for window in expected.rates {
                let rate = PrayerStats.completionRate(history, today: today, days: window.days)
                #expect(rate.done == window.prayer.prayed && rate.due == window.prayer.due, "\(context), \(window.days) days")
                #expect(rate.wholePercent == window.prayer.percent, "\(context), \(window.days) days")
                let sunnah = SunnahStats.completion(history, today: today, days: window.days)
                #expect(sunnah.rate.done == window.sunnah.prayed && sunnah.rate.due == window.sunnah.due, "\(context), sunnah \(window.days) days")
                #expect(sunnah.days == window.sunnah.days, "\(context)")
                #expect(Dictionary(uniqueKeysWithValues: sunnah.byPrayer.map { ($0.key.rawValue, $0.value) }) == window.sunnah.byPrayer)
            }
            for month in expected.months {
                let breakdown = PrayerStats.monthBreakdown(history, month: GregorianMonth(year: month.year, month: month.month), today: today)
                #expect(breakdown.elapsedDays == month.breakdown.elapsedDays, "\(context) \(month.year)-\(month.month)")
                #expect(breakdown.logged == month.breakdown.logged)
                #expect(Counts(breakdown.byStatus) == month.breakdown.byStatus)
                for prayer in Prayer.allCases {
                    #expect(Counts(breakdown.byPrayer[prayer]!) == month.breakdown.byPrayer[prayer.rawValue], "\(context) \(prayer)")
                }
            }
            let missed = PrayerStats.outstandingMissed(history, today: today)
            #expect(missed.count == expected.missed.count, "\(context)")
            #expect(missed.days.map(\.description) == expected.missed.dates)
            #expect(missed.prayers.map { "\($0.day) \($0.prayer.rawValue)" } == expected.missed.prayers.map { "\($0.dateKey) \($0.prayer)" })
            #expect(SunnahStats.firstSunnahDay(history, today: today)?.description == expected.firstSunnahDay, "\(context)")
            #expect(SunnahStats.witrStreaks(history, today: today) == expected.witr.streak, "\(context) witr")
            #expect(SunnahStats.rawatibStreaks(history, today: today) == expected.rawatib.streak, "\(context) rawatib")
            let lifetime = TrackerStats.lifetimePrayers(history, today: today)
            #expect(lifetime == LifetimePrayers(logged: expected.lifetime.logged, prayed: expected.lifetime.prayed, sunnah: expected.lifetime.sunnah), "\(context)")
            #expect(TrackerStats.hasAnyRecord(TrackerHistory(prayers: history), today: today) == expected.hasAnyRecord, "\(context)")
            for weeks in expected.weeks {
                // The website numbers weekdays 0 = Sunday; Calendar and DayKey from 1.
                let totals = TrackerStats.weeklyTotals(TrackerHistory(prayers: history), today: today, weekStart: weeks.weekStart + 1, weeks: 8)
                #expect(totals.map(\.start.description) == weeks.totals.map(\.start), "\(context) week start \(weeks.weekStart)")
                #expect(totals.map(\.days) == weeks.totals.map(\.days))
                #expect(totals.map(\.current) == weeks.totals.map(\.current))
                #expect(totals.map(\.prayed) == weeks.totals.map(\.prayed), "\(context)")
                #expect(totals.map(\.sunnah) == weeks.totals.map(\.sunnah), "\(context)")
                #expect(totals.map(\.azkar) == weeks.totals.map(\.azkar))
            }
        }
    }
}

extension PrayerStatsParityTests.Case: CustomTestStringConvertible {
    var testDescription: String { name }
}
