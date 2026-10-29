import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The same taps, at the same instants, leave the same records as on the website: operations.json
/// holds a scenario (one-tap logging, changes, clearing, future days, sunnah prayers after
/// midnight, counting a session to its end and back, starting over, a second reading, counts
/// pruned after thirty days, "today" in the saved place's zone) and what the website saved after it.
@Suite struct OperationsParityTests {
    static func replay(into store: RecordStore) async throws -> [(step: JSONValue, result: ChangeResult)] {
        let fixture = try Fixtures.json("operations.json")
        var results: [(JSONValue, ChangeResult)] = []
        for step in fixture["steps"]!.array! {
            let at = instant(step["at"]!.string!)
            let on = day(step["day"]!.string!)
            let change: RecordChange
            switch step["op"]!.string! {
            case "status":
                let prayer = Prayer(rawValue: step["prayer"]!.string!)!
                let status = step["status"]!.string.map { PrayerStatus(rawValue: $0)! }
                change = try await store.setPrayer(prayer, status, on: on, at: at)
            case "sunnah":
                change = try await store.setSunnah(SunnahPrayer(rawValue: step["sunnah"]!.string!)!, done: step["done"]!.bool!, on: on, at: at)
            case "reset":
                change = try await store.startOver(AzkarSession(step["session"]!.string!)!, on: on)
            case let op:
                let steps: [String: CountStep] = ["increment": .increment, "decrement": .decrement, "complete": .complete]
                change = try await store.count(steps[op]!, dhikr: step["dhikr"]!.string!, in: AzkarSession(step["session"]!.string!)!, on: on, at: at)
            }
            results.append((step, change.result))
        }
        return results
    }

    @Test func theScenarioLeavesWhatTheWebsiteSaved() async throws {
        let fixture = try Fixtures.json("operations.json")
        let store = try makeStore(zone: fixture["timeZone"]!.string!)
        _ = try await Self.replay(into: store)

        let written = WebStores.write(records: try await store.snapshot(), settings: SettingsSnapshot()).mapValues { $0["state"]! }
        let expected = fixture["expected"]!
        expectSameJSON(written["azkar:prayer-log"], expected["prayer-log"], "prayer-log")
        expectSameJSON(written["azkar:azkar-progress"]?.only(WebHydrationParityTests.progressFields), expected["azkar-progress"], "azkar-progress")
    }

    @Test func futureDaysAreRefusedOnlyWhereTheWebsiteRefusesThem() async throws {
        let fixture = try Fixtures.json("operations.json")
        let store = try makeStore(zone: fixture["timeZone"]!.string!)
        let refused = try await Self.replay(into: store).filter { $0.result == .refusedFutureDay }.map { $0.step }
        #expect(refused.map { $0["op"]! } == ["status", "sunnah", "status"])
        #expect(refused.map { $0["day"]! } == ["2026-09-02", "2026-09-03", "2026-10-14"])
    }

    @Test func aModelFollowingTheScenarioShowsWhatTheStoreHolds() async throws {
        let fixture = try Fixtures.json("operations.json")
        let store = try makeStore(zone: fixture["timeZone"]!.string!)
        let model = await RecordsModel(store: store)
        await model.reload()
        // The same scenario through the model: its copy, patched after every change, must equal a fresh read.
        for step in fixture["steps"]!.array! {
            let on = day(step["day"]!.string!)
            switch step["op"]!.string! {
            case "status":
                try await model.setPrayer(Prayer(rawValue: step["prayer"]!.string!)!, step["status"]!.string.map { PrayerStatus(rawValue: $0)! }, on: on)
            case "sunnah":
                try await model.setSunnah(SunnahPrayer(rawValue: step["sunnah"]!.string!)!, done: step["done"]!.bool!, on: on)
            case "reset":
                try await model.startOver(AzkarSession(step["session"]!.string!)!, on: on)
            case let op:
                let steps: [String: CountStep] = ["increment": .increment, "decrement": .decrement, "complete": .complete]
                try await model.count(steps[op]!, dhikr: step["dhikr"]!.string!, in: AzkarSession(step["session"]!.string!)!, on: on)
            }
        }
        let shown = await model.records
        #expect(shown == (try await store.snapshot()))
        #expect(!shown.isEmpty)
    }
}
