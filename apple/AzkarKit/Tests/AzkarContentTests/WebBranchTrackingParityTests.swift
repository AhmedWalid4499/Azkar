import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// The bedtime, after-prayer and tasbih statistics give what the web branch's `tracking.ts`,
/// `afterPrayerTracking.ts` and `tasbihTracking.ts` give on the same records (fixtures from
/// `scripts/native/content`, made by running that branch's code).
@Suite("Bedtime, after-prayer and tasbih statistics match the web branch")
struct WebBranchTrackingParityTests {
    struct Rate: Decodable {
        var completed: Int
        var due: Int

        var rate: CompletionRate { CompletionRate(done: completed, due: due) }
    }

    struct SleepRate: Decodable {
        var days: Int
        var completed: Int
        var due: Int
    }

    struct SleepResult: Decodable {
        var today: String
        var phase: String
        var streak: WebStreak
        var rates: [SleepRate]
    }

    struct SleepCase: Decodable {
        var name: String
        var sessions: [String: [String: WebSession]]
        var results: [SleepResult]
    }

    struct AfterPrayerStreaksFixture: Decodable {
        var all: WebStreak
        var byPrayer: [String: WebStreak]
    }

    struct AfterPrayerRatesFixture: Decodable {
        var days: Int
        var all: Rate
        var byPrayer: [String: Rate]
    }

    struct PrayerSet: Decodable {
        var prayers: [String]
        var streaks: AfterPrayerStreaksFixture
        var rates: [AfterPrayerRatesFixture]
    }

    struct AfterPrayerResult: Decodable {
        var today: String
        var phase: String
        var sets: [PrayerSet]
    }

    struct AfterPrayerCase: Decodable {
        var name: String
        var history: [String: [String: WebSession]]
        var lifetime: [String: Int]
        var results: [AfterPrayerResult]
    }

    struct DateKeys: Decodable {
        var today: String
        var phase: String
        var key: String
        var afterPrayerKey: String
    }

    struct WebTasbihRecord: Decodable {
        var count: Int
        var lastAt: Double?
    }

    struct WebTasbihDay: Decodable {
        var presets: [String: WebTasbihRecord]
        var free: WebTasbihRecord?
    }

    struct Tasbih: Decodable {
        struct Progress: Decodable {
            var days: [String: WebTasbihDay]
        }

        struct Lifetime: Decodable {
            struct Row: Decodable {
                var id: String
                var recitations: Int
                var snippet: String?
            }

            var count: Int
            var free: Int
            var byPreset: [Row]
            var days: Int
        }

        struct Range: Decodable {
            var from: String
            var to: String
            var days: [[AnyCodableOptional]]
        }

        struct Since: Decodable {
            var today: String
            var days: Int
            var count: Int
        }

        var progress: Progress
        var lifetime: Lifetime
        var ranges: [Range]
        var since: [Since]
    }

    struct Fixture: Decodable {
        var sleep: [SleepCase]
        var afterPrayer: [AfterPrayerCase]
        var tasbihDateKeys: [DateKeys]
        var tasbih: Tasbih
    }

    static func load() throws -> Fixture { try Fixtures.load(Fixture.self, "web-branch-tracking.json") }

    /// The web branch files the after-prayer records by the prayer's name alone.
    static func afterPrayerHistory(_ web: [String: [String: WebSession]]) -> SessionHistory {
        WebData.sessions(web.mapValues { day in
            Dictionary(uniqueKeysWithValues: day.map { ("afterPrayer:\($0.key)", $0.value) })
        })
    }

    static func tasbihHistory(_ days: [String: WebTasbihDay]) -> TasbihHistory {
        days.reduce(into: TasbihHistory()) { history, entry in
            var records = entry.value.presets.map { TasbihRecord(preset: $0.key, count: $0.value.count, lastAt: $0.value.lastAt.map(instant)) }
            if let free = entry.value.free {
                records.append(TasbihRecord(preset: TasbihRecord.freeCount, count: free.count, lastAt: free.lastAt.map(instant)))
            }
            history[day(entry.key)] = records
        }
    }

    @Test("The fixtures load with every kind of case")
    func fixturesLoad() throws {
        let fixture = try Self.load()
        #expect(fixture.sleep.count >= 3)
        #expect(fixture.afterPrayer.count >= 3)
        #expect(fixture.tasbih.since.count >= 8)
    }

    @Test("The bedtime streak and rates match at every part of the day")
    func sleep() throws {
        for fixture in try Self.load().sleep {
            let history = WebData.sessions(fixture.sessions)
            for expected in fixture.results {
                let today = day(expected.today)
                let beforeDawn = expected.phase == "beforeDawn"
                let context = "\(fixture.name) on \(expected.today), \(expected.phase)"
                #expect(AzkarStats.streak(of: .sleep, in: history, today: today, beforeDawn: beforeDawn) == expected.streak.streak, "\(context)")
                for window in expected.rates {
                    let rate = AzkarStats.completionRate(of: .sleep, in: history, today: today, beforeDawn: beforeDawn, days: window.days)
                    #expect(rate == CompletionRate(done: window.completed, due: window.due), "\(context), \(window.days) days")
                }
            }
        }
    }

    @Test("After-prayer streaks, rates and completed totals match for every set of prayers")
    func afterPrayer() throws {
        for fixture in try Self.load().afterPrayer {
            let history = Self.afterPrayerHistory(fixture.history)
            let lifetime = AfterPrayerStats.lifetime(history)
            for prayer in Prayer.allCases {
                #expect(lifetime.completed[prayer] == fixture.lifetime[prayer.rawValue], "\(fixture.name) \(prayer)")
            }
            for expected in fixture.results {
                let today = day(expected.today)
                let beforeDawn = expected.phase == "beforeDawn"
                for set in expected.sets {
                    let prayers = set.prayers.map { Prayer(rawValue: $0)! }
                    let context = "\(fixture.name) on \(expected.today), \(expected.phase), \(set.prayers)"
                    let streaks = AfterPrayerStats.streaks(history, today: today, beforeDawn: beforeDawn, prayers: prayers)
                    #expect(streaks.all == set.streaks.all.streak, "\(context)")
                    for prayer in Prayer.allCases {
                        #expect(streaks.byPrayer[prayer] == set.streaks.byPrayer[prayer.rawValue]?.streak, "\(context) \(prayer)")
                    }
                    for window in set.rates {
                        let rates = AfterPrayerStats.completionRates(history, today: today, beforeDawn: beforeDawn, days: window.days, prayers: prayers)
                        #expect(rates.all == window.all.rate, "\(context), \(window.days) days")
                        for prayer in Prayer.allCases {
                            #expect(rates.byPrayer[prayer] == window.byPrayer[prayer.rawValue]?.rate, "\(context), \(window.days) days, \(prayer)")
                        }
                    }
                }
            }
        }
    }

    @Test("A tasbih count and the after-prayer azkar are filed under the day the web branch files them")
    func dateKeys() throws {
        for expected in try Self.load().tasbihDateKeys {
            let beforeDawn = expected.phase == "beforeDawn"
            #expect(TasbihStats.openDay(today: day(expected.today), beforeDawn: beforeDawn).description == expected.key)
            #expect(AfterPrayerStats.openDay(today: day(expected.today), beforeDawn: beforeDawn).description == expected.afterPrayerKey)
        }
    }

    @Test("Tasbih days, recent counts and lifetime totals match")
    func tasbih() throws {
        let fixture = try Self.load().tasbih
        let history = Self.tasbihHistory(fixture.progress.days)
        for range in fixture.ranges {
            let days = TasbihStats.days(in: history, from: day(range.from), to: day(range.to))
            #expect(days.map(\.day.description) == range.days.map { $0[0].string ?? "" }, "\(range.from)…\(range.to)")
            #expect(days.map(\.count) == range.days.map { $0[1].int ?? -1 }, "\(range.from)…\(range.to)")
        }
        for since in fixture.since {
            #expect(TasbihStats.count(history, today: day(since.today), days: since.days) == since.count, "\(since.today), \(since.days) days")
        }
        // The fixture keeps the web branch's never-pruned totals in step with its days, so the
        // native totals, taken from the days (which it keeps for good), must come out the same.
        let lifetime = TasbihStats.lifetime(history)
        #expect(lifetime.count == fixture.lifetime.count)
        #expect(lifetime.free == fixture.lifetime.free)
        #expect(lifetime.days == fixture.lifetime.days)
        #expect(lifetime.byPreset.map(\.id) == fixture.lifetime.byPreset.map(\.id))
        #expect(lifetime.byPreset.map(\.recitations) == fixture.lifetime.byPreset.map(\.recitations))
    }
}
