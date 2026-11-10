import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

@Suite struct SweepFixTests {
    let start = instant("2026-11-01T05:00:00Z")

    @Test func addingTheSameBackupTwiceLeavesTheLifetimeTotalsAsTheyWere() async throws {
        var records = RecordsSnapshot()
        records.totals = LifetimeTotals(dhikr: ["kursi": 500], recitations: 12_000, afterPrayer: ["kursi": 40], tasbih: ["subhanallah": 330], tasbihFree: 7)
        let store = try makeStore()
        try await store.replaceAll(with: records)
        try await store.merge(records)
        try await store.merge(records)
        #expect(try await store.totals() == records.totals)

        // A larger figure from elsewhere is taken; a smaller one never lowers what is here.
        var more = records
        more.totals.recitations = 15_000
        more.totals.dhikr["kursi"] = 100
        try await store.merge(more)
        let totals = try await store.totals()
        #expect(totals.recitations == 15_000)
        #expect(totals.dhikr["kursi"] == 500)
    }

    @Test func aBackupWithAHugeNumberInItsSettingsIsReadNotCrashedOn() throws {
        let huge: JSONValue = .number(1e20)
        let reader = ReaderSettings(web: ["arabicScale": huge])
        #expect(reader.arabicScale == ReaderSettings().arabicScale)
        let reminders = ReminderSettings(web: [
            "unloggedReminders": ["enabled": true, "leadMinutes": huge],
            "seasonReminders": ["suhoorLeadMinutes": huge, "witrDelayMinutes": huge, "zakatDue": ["month": huge, "day": huge]],
        ])
        #expect(reminders.unloggedLeadMinutes == ReminderSettings().unloggedLeadMinutes)
        #expect(reminders.season.zakatDue == nil)
    }
}
