import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// The azkar statistics give exactly what the website's `tracking.ts` gives on the same records,
/// in every part of the day (fixtures from `scripts/native/content`).
@Suite("Azkar statistics match the website")
struct AzkarStatsParityTests {
    struct Rate: Decodable {
        var completed: Int
        var due: Int

        var rate: CompletionRate { CompletionRate(done: completed, due: due) }
    }

    struct Rates: Decodable {
        var days: Int
        var all, morning, evening: Rate
        var percent: Int?
    }

    struct Streaks: Decodable {
        var morning, evening, both: WebStreak
    }

    struct Week: Decodable {
        var start: String
        var azkar: Int
        var days: Int
    }

    struct Result: Decodable {
        var today: String
        var phase: String
        var streaks: Streaks
        var rates: [Rates]
        var weeks: [Week]
    }

    struct Lifetime: Decodable {
        struct Row: Decodable {
            var id: String
            var recitations: Int
            var snippet: String?
        }

        var sessionsCompleted: [String: Int]
        var recitations: Int
        var byDhikr: [Row]
    }

    struct Case: Decodable, CustomTestStringConvertible {
        var name: String
        var sessions: [String: [String: WebSession]]
        var totals: [String: Int]
        var totalRecitations: Int
        var lifetime: Lifetime
        var results: [Result]

        var testDescription: String { name }
    }

    static let cases: [Case] = (try? Fixtures.load([Case].self, "azkar-stats.json")) ?? []

    @Test("The fixtures load")
    func fixturesLoad() throws {
        #expect(try Fixtures.load([Case].self, "azkar-stats.json").count >= 4)
    }

    @Test("Streaks, rates and weekly counts match in every part of the day", arguments: cases)
    func streaksAndRates(_ fixture: Case) {
        let history = WebData.sessions(fixture.sessions)
        for expected in fixture.results {
            let today = day(expected.today)
            let beforeDawn = expected.phase == "beforeDawn"
            let context = "\(fixture.name) on \(expected.today), \(expected.phase)"
            let streaks = AzkarStats.streaks(history, today: today, beforeDawn: beforeDawn)
            #expect(streaks.morning == expected.streaks.morning.streak, "\(context) morning")
            #expect(streaks.evening == expected.streaks.evening.streak, "\(context) evening")
            #expect(streaks.both == expected.streaks.both.streak, "\(context) both")
            for window in expected.rates {
                let rates = AzkarStats.completionRates(history, today: today, beforeDawn: beforeDawn, days: window.days)
                #expect(rates.all == window.all.rate, "\(context), \(window.days) days")
                #expect(rates.morning == window.morning.rate, "\(context), \(window.days) days")
                #expect(rates.evening == window.evening.rate, "\(context), \(window.days) days")
                #expect(rates.all.wholePercent == window.percent)
            }
            // The website's weeks start on 0 = Sunday … 6 = Saturday; these were made with 6.
            let weeks = TrackerStats.weeklyTotals(TrackerHistory(sessions: history), today: today, weekStart: 7, weeks: 8)
            #expect(weeks.map(\.start.description) == expected.weeks.map(\.start))
            #expect(weeks.map(\.azkar) == expected.weeks.map(\.azkar), "\(context)")
            #expect(weeks.map(\.days) == expected.weeks.map(\.days))
        }
    }

    @Test("Lifetime totals match, the snippets taken from the dataset", arguments: cases)
    func lifetime(_ fixture: Case) {
        let lifetime = AzkarStats.lifetime(WebData.sessions(fixture.sessions), totals: fixture.totals, totalRecitations: fixture.totalRecitations)
        for (key, count) in fixture.lifetime.sessionsCompleted {
            #expect(lifetime.sessionsCompleted[AzkarSession(key)!] == count, "\(fixture.name) \(key)")
        }
        #expect(lifetime.recitations == fixture.lifetime.recitations)
        #expect(lifetime.byDhikr.map(\.id) == fixture.lifetime.byDhikr.map(\.id))
        #expect(lifetime.byDhikr.map(\.recitations) == fixture.lifetime.byDhikr.map(\.recitations))
        #expect(lifetime.byDhikr.map(\.snippet) == fixture.lifetime.byDhikr.map(\.snippet))
    }
}
