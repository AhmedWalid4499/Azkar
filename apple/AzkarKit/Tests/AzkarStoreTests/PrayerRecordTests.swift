import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The prayer log's operations, as src/features/prayer-log/store.ts has them.
@Suite struct PrayerRecordTests {
    let today = day("2026-09-01")
    let noon = instant("2026-09-01T12:00:00Z")

    @Test func oneTapLogsAPrayerOnTimeAndStampsIt() async throws {
        let store = try makeStore()
        let change = try await store.logPrayer(.fajr, on: today, at: noon)
        #expect(change.result == .changed)
        #expect(change.day.prayer.prayers[.fajr] == PrayerEntry(status: .ontime, loggedAt: noon))
    }

    @Test func oneTapOnALoggedPrayerLeavesItAsItIs() async throws {
        let store = try makeStore()
        try await store.setPrayer(.fajr, .jamaah, on: today, at: noon)
        let change = try await store.logPrayer(.fajr, on: today, at: noon.addingTimeInterval(60))
        #expect(change.result == .unchanged)
        #expect(change.day.prayer.prayers[.fajr] == PrayerEntry(status: .jamaah, loggedAt: noon))
    }

    @Test func anyStatusCanBeSetAndChangedWithANewStamp() async throws {
        let store = try makeStore()
        for (offset, status) in PrayerStatus.allCases.enumerated() {
            let at = noon.addingTimeInterval(Double(offset))
            #expect(try await store.setPrayer(.asr, status, on: today, at: at).day.prayer.prayers[.asr] == PrayerEntry(status: status, loggedAt: at))
        }
    }

    @Test func theSameStatusAgainKeepsItsTime() async throws {
        let store = try makeStore()
        try await store.setPrayer(.isha, .late, on: today, at: noon)
        let again = try await store.setPrayer(.isha, .late, on: today, at: noon.addingTimeInterval(3600))
        #expect(again.result == .unchanged)
        #expect(again.day.prayer.prayers[.isha]?.loggedAt == noon)
    }

    @Test func clearingRemovesTheStatusAndItsTimeAndAnEmptyDay() async throws {
        let store = try makeStore()
        try await store.setPrayer(.maghrib, .ontime, on: today, at: noon)
        let cleared = try await store.clearPrayer(.maghrib, on: today)
        #expect(cleared.result == .changed)
        #expect(cleared.day.isEmpty)
        #expect(try await store.daysWithRecords().isEmpty)
        #expect(try await store.clearPrayer(.maghrib, on: today).result == .unchanged)
    }

    @Test func aDayNotYetBegunWhereTheUserIsCannotBeLoggedButCanBeCleared() async throws {
        // 20:00 UTC on 1 September is already 2 September in Tokyo.
        let late = instant("2026-09-01T20:00:00Z")
        let utc = try makeStore(zone: "UTC")
        #expect(try await utc.setPrayer(.fajr, .ontime, on: day("2026-09-02"), at: late).result == .refusedFutureDay)
        let tokyo = try makeStore(zone: "Asia/Tokyo")
        #expect(try await tokyo.setPrayer(.fajr, .ontime, on: day("2026-09-02"), at: late).result == .changed)
        #expect(try await tokyo.setPrayer(.fajr, .ontime, on: day("2026-09-03"), at: late).result == .refusedFutureDay)
        #expect(try await tokyo.logPrayer(.dhuhr, on: day("2026-09-03"), at: late).result == .refusedFutureDay)
        #expect(try await tokyo.clearPrayer(.fajr, on: day("2026-09-02")).result == .changed)
    }

    @Test func sunnahPrayersAreTickedWithTheirTimeAndUnticked() async throws {
        let store = try makeStore()
        let ticked = try await store.setSunnah(.witr, done: true, on: today, at: noon)
        #expect(ticked.result == .changed)
        #expect(ticked.day.prayer.sunnah == [.witr: noon])
        #expect(try await store.setSunnah(.witr, done: true, on: today, at: noon.addingTimeInterval(9)).result == .unchanged)
        #expect(try await store.day(today).prayer.sunnah[.witr] == noon)
        #expect(try await store.setSunnah(.witr, done: false, on: today, at: noon).day.isEmpty)
        #expect(try await store.setSunnah(.witr, done: false, on: today, at: noon).result == .unchanged)
    }

    @Test func aSunnahPrayerOnADayNotYetBegunCannotBeTickedButCanBeUnticked() async throws {
        let store = try makeStore()
        let tomorrow = today.adding(days: 1)
        #expect(try await store.setSunnah(.duha, done: true, on: tomorrow, at: noon).result == .refusedFutureDay)
        // Ticked while it was today somewhere east, then the zone changed back.
        try await store.setSunnah(.duha, done: true, on: tomorrow, at: noon.addingTimeInterval(86_400))
        #expect(try await store.setSunnah(.duha, done: false, on: tomorrow, at: noon).result == .changed)
    }

    @Test func timesAreKeptToTheWholeMillisecondAsTheWebsiteKeepsThem() async throws {
        let store = try makeStore()
        let precise = Date(timeIntervalSince1970: 1_788_207_000.123_456)
        let change = try await store.logPrayer(.fajr, on: day("2026-08-31"), at: precise)
        #expect(change.day.prayer.prayers[.fajr]?.loggedAt == Date(epochMilliseconds: 1_788_207_000_123))
    }
}
