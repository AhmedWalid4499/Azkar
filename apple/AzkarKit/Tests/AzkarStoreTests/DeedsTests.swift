import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

@Suite struct PrayerMakeupTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")

    @Test func whatIsLeftIsWorkedOutFromTheLog() async throws {
        let store = try makeStore()
        _ = try await store.setOwedPrayersBefore([.fajr: 3, .isha: 1], at: start)
        let change = try await store.logMakeup(.fajr, on: today, at: start)
        #expect(change.day.makeups.map(\.prayer) == [.fajr])
        var backlog = PrayerBacklog(owedBefore: change.owedPrayersBefore, makeups: try await store.snapshot().makeups)
        #expect(backlog.remaining(.fajr) == 2)
        #expect(backlog.remaining == 3)
        #expect(backlog.madeUpCount == 1)

        _ = try await store.undoMakeup(try #require(change.day.makeups.first?.id))
        backlog = PrayerBacklog(owedBefore: change.owedPrayersBefore, makeups: try await store.snapshot().makeups)
        #expect(backlog.remaining(.fajr) == 3)
    }

    @Test func makingUpMoreThanWasOwedLeavesNothingNotLessThanNothing() {
        let makeups = [PrayerMakeup(prayer: .asr, day: today, at: start), PrayerMakeup(prayer: .asr, day: today, at: start)]
        #expect(PrayerBacklog(owedBefore: [.asr: 1], makeups: makeups).remaining(.asr) == 0)
    }

    @Test func theCountsStayWithinTheLimitAndAPrayerLeftOutOwesNothing() async throws {
        let store = try makeStore()
        _ = try await store.setOwedPrayersBefore([.fajr: 999_999, .dhuhr: 5], at: start)
        _ = try await store.setOwedPrayersBefore([.fajr: 999_999], at: start)
        #expect(try await store.snapshot().owedPrayersBefore == [.fajr: RecordLimits.maxOwedPrayersBefore])
    }

    @Test func aDayNotYetBegunIsRefused() async throws {
        let store = try makeStore()
        #expect(try await store.logMakeup(.fajr, on: today.adding(days: 2), at: start).result == .refusedFutureDay)
    }
}

@Suite struct GivingTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")

    @Test func anAmountNeedsACurrencyAndANoteIsTidied() {
        #expect(GivingEntry(kind: .sadaqah, day: today, at: start, amount: 5).amount == nil)
        #expect(GivingEntry(kind: .sadaqah, day: today, at: start, currency: "USD").currency == nil)
        #expect(GivingEntry(kind: .sadaqah, day: today, at: start, amount: 0, currency: "USD").amount == nil)
        #expect(GivingEntry(kind: .sadaqah, day: today, at: start, note: "  ").note == nil)
        #expect(GivingEntry(kind: .sadaqah, day: today, at: start, note: " food\n").note == "food")
    }

    @Test func anAmountIsReadInEitherDigitsWithEitherDecimalMark() {
        #expect(GivingEntry.parsedAmount("12.50") == Decimal(string: "12.5"))
        #expect(GivingEntry.parsedAmount("12,50") == Decimal(string: "12.5"))
        #expect(GivingEntry.parsedAmount("١٢٫٥٠") == Decimal(string: "12.5"))
        #expect(GivingEntry.parsedAmount("۱۲") == 12)
        for text in ["", ".", "0", "1.2.3", "ten", "-5"] { #expect(GivingEntry.parsedAmount(text) == nil) }
    }

    @Test func currenciesAreNeverAddedTogether() {
        let summary = GivingSummary(entries: [
            GivingEntry(kind: .sadaqah, day: today, at: start, amount: Decimal(string: "10.10"), currency: "USD"),
            GivingEntry(kind: .sadaqah, day: today, at: start, amount: Decimal(string: "0.20"), currency: "USD"),
            GivingEntry(kind: .sadaqah, day: today, at: start, amount: 50, currency: "EGP"),
            GivingEntry(kind: .sadaqah, day: today, at: start),
            GivingEntry(kind: .zakat, day: today, at: start, amount: 100, currency: "USD"),
        ])
        #expect(summary.entries == 5)
        #expect(summary.counts[.sadaqah] == 4)
        #expect(summary.totals[.sadaqah] == [.init(currency: "EGP", amount: 50), .init(currency: "USD", amount: Decimal(string: "10.30")!)])
        #expect(summary.totals[.zakat]?.first?.amount == 100)
    }

    @Test func aRowKeepsTheAmountToTheDigit() async throws {
        let store = try makeStore()
        let amount = try #require(Decimal(string: "1234.56"))
        _ = try await store.logGiving(GivingEntry(kind: .zakat, day: today, at: start, amount: amount, currency: "SAR", note: "Mosque"))
        let entry = try #require(try await store.snapshot().giving.first)
        #expect(entry.amount == amount)
        #expect(entry.currency == "SAR")
        #expect(entry.note == "Mosque")
        _ = try await store.removeGiving(entry.id)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func aDayNotYetBegunIsRefused() async throws {
        let store = try makeStore()
        #expect(try await store.logGiving(GivingEntry(kind: .sadaqah, day: today.adding(days: 2), at: start)).result == .refusedFutureDay)
    }
}

@Suite struct DuaTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")

    private func progress(_ store: RecordStore) async throws -> DuaProgress {
        let records = try await store.snapshot()
        return DuaProgress(items: records.duas, entries: records.duaEntries)
    }

    @Test func nothingButSpacesAddsNothing() async throws {
        let store = try makeStore()
        #expect(try await store.addDua(" \n ", at: start).result == .unchanged)
        #expect(try await store.addDua(" Guide me\n", at: start).duas.map(\.text) == ["Guide me"])
    }

    @Test func aDuaAnsweredMovesAcrossOnceAndCanBeTakenBack() async throws {
        let store = try makeStore()
        let id = try #require(try await store.addDua("Guide me", at: start).duas.first?.id)
        _ = try await store.logDua(.said, dua: id, on: today, at: start)
        _ = try await store.logDua(.said, dua: id, on: today, at: start.addingTimeInterval(60))
        #expect(try await progress(store).open.first?.said == 2)

        #expect(try await store.logDua(.answered, dua: id, on: today, at: start).changed)
        #expect(try await store.logDua(.answered, dua: id, on: today, at: start).result == .unchanged)
        var now = try await progress(store)
        #expect(now.open.isEmpty)
        let answered = try #require(now.answered.first?.answered)
        #expect(now.answered.first?.said == 2)

        _ = try await store.undoDuaEntry(answered.id)
        now = try await progress(store)
        #expect(now.open.map(\.item.text) == ["Guide me"])
    }

    @Test func takingADuaOffKeepsTheDaysItWasSaidAndForgetsItsWords() async throws {
        let store = try makeStore()
        let id = try #require(try await store.addDua("Guide me", at: start).duas.first?.id)
        _ = try await store.logDua(.said, dua: id, on: today, at: start)
        _ = try await store.removeDua(id, at: start)
        let records = try await store.snapshot()
        #expect(records.duas.isEmpty)
        #expect(records.duaEntries.count == 1)
        #expect(try await progress(store).totalSaid == 1)
        #expect(try await store.logDua(.said, dua: id, on: today, at: start).result == .unchanged)
    }

    @Test func editingKeepsItsHistoryAndSeveralCanBeSaidTogether() async throws {
        let store = try makeStore()
        let first = try #require(try await store.addDua("One", at: start).duas.first?.id)
        let second = try #require(try await store.addDua("Two", at: start.addingTimeInterval(1)).duas.last?.id)
        _ = try await store.logDuasSaid([first, second, UUID()], on: today, at: start)
        _ = try await store.editDua(first, text: "One, again", at: start)
        let now = try await progress(store)
        #expect(now.totalSaid == 2)
        #expect(now.open.map(\.item.text) == ["Two", "One, again"])
        #expect(now.open.map(\.said) == [1, 1])
    }
}

@Suite struct DeedsBackupTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")

    private func filled() async throws -> RecordStore {
        let store = try makeStore()
        _ = try await store.setOwedPrayersBefore([.fajr: 300], at: start)
        _ = try await store.logMakeup(.fajr, on: today, at: start)
        _ = try await store.logGiving(GivingEntry(kind: .zakat, day: today, at: start, amount: Decimal(string: "99.95"), currency: "USD", note: "Family"))
        let id = try #require(try await store.addDua("دعاء", at: start).duas.first?.id)
        _ = try await store.logDua(.said, dua: id, on: today, at: start)
        return store
    }

    @Test func aBackupCarriesItAllAndAMergeNeverDoublesIt() async throws {
        let records = try await filled().snapshot()
        let data = Backup.export(records: records, settings: SettingsSnapshot(), at: start)
        let read = try Backup.read(data, catalog: Fixtures.catalog)
        #expect(read.snapshot.records.makeups == records.makeups)
        #expect(read.snapshot.records.owedPrayersBefore == records.owedPrayersBefore)
        #expect(read.snapshot.records.giving == records.giving)
        #expect(read.snapshot.records.duas == records.duas)
        #expect(read.snapshot.records.duaEntries == records.duaEntries)

        let other = try makeStore()
        try await other.replaceAll(with: read.snapshot.records)
        try await other.merge(read.snapshot.records)
        let merged = try await other.snapshot()
        #expect(merged.makeups.count == 1)
        #expect(merged.giving.count == 1)
        #expect(merged.duas.count == 1)
        #expect(merged.duaEntries.count == 1)
        #expect(merged.owedPrayersBefore == [.fajr: 300])

        try await other.replaceAll(with: RecordsSnapshot())
        #expect(try await other.snapshot().isEmpty)
    }

    @Test func theNumberAlreadyHereWinsAMerge() async throws {
        let store = try makeStore()
        _ = try await store.setOwedPrayersBefore([.fajr: 10], at: start)
        var incoming = RecordsSnapshot()
        incoming.owedPrayersBefore = [.fajr: 300, .isha: 7]
        try await store.merge(incoming)
        #expect(try await store.snapshot().owedPrayersBefore == [.fajr: 10, .isha: 7])
    }

    @Test func aBackupWithoutThemWritesNoStoreAndUnreadableLinesAreSkipped() {
        let data = Backup.export(records: RecordsSnapshot(), settings: SettingsSnapshot(), at: start)
        let text = String(decoding: data, as: UTF8.self)
        for key in ["azkar:giving", "azkar:duas", "azkar:prayer-makeups"] { #expect(!text.contains(key)) }
        #expect(WebGiving.read(["entries": [["id": "nope", "kind": "zakat", "day": "2026-11-01", "at": 1]]]).isEmpty)
        #expect(WebDuas.read(["items": [["id": .string(UUID().uuidString), "text": "  ", "addedAt": 1]]]).items.isEmpty)
        #expect(WebMakeups.read(["owedBefore": ["fajr": -3]]).owedBefore.isEmpty)
    }

    @Test func theZakatDateAndItsRemindersGoWithTheSettings() throws {
        var reminders = ReminderSettings()
        reminders.season.zakat = true
        reminders.season.zakatFitr = true
        reminders.season.zakatDue = HijriMonthDay(month: 9, day: 27)
        #expect(ReminderSettings(web: reminders.web).season == reminders.season)
        #expect(HijriMonthDay(month: 13, day: 1) == nil)
        #expect(HijriMonthDay(month: 1, day: 31) == nil)
    }
}
