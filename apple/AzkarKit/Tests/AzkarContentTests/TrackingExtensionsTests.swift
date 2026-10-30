import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

private func completed(_ recitations: Int = 10) -> SessionRecord {
    SessionRecord(completed: true, done: 3, total: 3, recitations: recitations)
}

private func started(_ recitations: Int = 2) -> SessionRecord {
    SessionRecord(completed: false, done: 1, total: 3, recitations: recitations)
}

/// The bedtime, after-prayer and tasbih statistics the native tracker adds, following the web
/// branch's rules, by hand; `WebBranchTrackingParityTests` checks them against that branch's own code.
@Suite("After-prayer, bedtime and tasbih statistics")
struct TrackingExtensionsTests {
    let today = day("2026-10-29")

    @Test("Before dawn every session but the morning is filed under the day before")
    func openDays() {
        #expect(AzkarStats.openDay(of: .morning, today: today, beforeDawn: true) == today)
        for session in [AzkarSession.evening, .sleep, .afterPrayer(.isha), .afterPrayer(.maghrib)] {
            #expect(AzkarStats.openDay(of: session, today: today, beforeDawn: true) == day("2026-10-28"))
            #expect(AzkarStats.openDay(of: session, today: today, beforeDawn: false) == today)
        }
        #expect(AfterPrayerStats.openDay(today: today, beforeDawn: true) == day("2026-10-28"))
        #expect(TasbihStats.openDay(today: today, beforeDawn: true) == day("2026-10-28"))
        #expect(TrackerStats.statsDay(today: today, beforeDawn: true) == day("2026-10-28"))
        #expect(TrackerStats.statsDay(today: today, beforeDawn: false) == today)
    }

    @Test("The bedtime streak runs over nights read in a row, and tonight is never held against")
    func sleepStreak() {
        let history: SessionHistory = [
            day("2026-10-24"): [.sleep: completed()],
            day("2026-10-26"): [.sleep: completed()],
            day("2026-10-27"): [.sleep: completed()],
            day("2026-10-28"): [.sleep: completed(), .morning: completed()],
        ]
        #expect(AzkarStats.streak(of: .sleep, in: history, today: today, beforeDawn: false) == Streak(current: 3, best: 3))
        // Last night still open before dawn; with it unread the run stands at the night before.
        var unread = history
        unread[day("2026-10-28")] = [.morning: completed()]
        #expect(AzkarStats.streak(of: .sleep, in: unread, today: today, beforeDawn: true) == Streak(current: 2, best: 2))
        #expect(AzkarStats.streak(of: .sleep, in: unread, today: today, beforeDawn: false) == Streak(current: 0, best: 2))
        // Bedtime never counts towards the daily streaks.
        #expect(AzkarStats.streaks(history, today: today, beforeDawn: false).evening == .none)
    }

    @Test("The bedtime rate is counted from the first night it was read")
    func sleepRate() {
        let history: SessionHistory = [
            day("2026-10-01"): [.morning: completed()],
            day("2026-10-26"): [.sleep: completed()],
            day("2026-10-27"): [.sleep: started()],
            day("2026-10-29"): [.sleep: completed()],
        ]
        // 26, 27, 28 closed (1 of 3); tonight completed counts, so 2 of 4.
        #expect(AzkarStats.completionRate(of: .sleep, in: history, today: today, beforeDawn: false, days: 30) == CompletionRate(done: 2, due: 4))
        // Before dawn tonight's record is a day after the open night: not counted yet.
        #expect(AzkarStats.completionRate(of: .sleep, in: history, today: today, beforeDawn: true, days: 30) == CompletionRate(done: 1, due: 2))
        #expect(AzkarStats.completionRate(of: .sleep, in: [:], today: today, beforeDawn: false, days: 7).rate == nil)
    }

    @Test("After-prayer streaks count each prayer, and all of them on one day")
    func afterPrayerStreaks() {
        let all = Dictionary(uniqueKeysWithValues: Prayer.allCases.map { (AzkarSession.afterPrayer($0), completed()) })
        var history: SessionHistory = [day("2026-10-26"): all, day("2026-10-27"): all, day("2026-10-28"): all]
        history[day("2026-10-28")]![.afterPrayer(.asr)] = started()
        history[today] = [.afterPrayer(.fajr): completed()]
        let streaks = AfterPrayerStats.streaks(history, today: today, beforeDawn: false, prayers: Prayer.allCases)
        #expect(streaks.byPrayer[.fajr] == Streak(current: 4, best: 4))
        #expect(streaks.byPrayer[.asr] == Streak(current: 0, best: 2))
        // Today's Dhuhr to Isha are still to come: they do not end the run.
        #expect(streaks.byPrayer[.isha] == Streak(current: 3, best: 3))
        #expect(streaks.all == Streak(current: 0, best: 2))
        // Only the prayers asked for are counted: without Asr, every day so far is complete.
        let withoutAsr = AfterPrayerStats.streaks(history, today: today, beforeDawn: false, prayers: [.fajr, .dhuhr, .maghrib, .isha])
        #expect(withoutAsr.all == Streak(current: 3, best: 3))
        #expect(withoutAsr.byPrayer[.asr] == Streak.none)
        #expect(AfterPrayerStats.streaks(history, today: today, beforeDawn: false, prayers: []).all == .none)
    }

    @Test("After-prayer rates leave out the days before the first record and the prayers still to come")
    func afterPrayerRates() {
        let history: SessionHistory = [
            day("2026-10-20"): [.morning: completed()],
            day("2026-10-27"): [.afterPrayer(.fajr): completed(), .afterPrayer(.isha): started()],
            day("2026-10-28"): [.afterPrayer(.fajr): completed(), .afterPrayer(.maghrib): completed()],
            today: [.afterPrayer(.fajr): completed()],
        ]
        let rates = AfterPrayerStats.completionRates(history, today: today, beforeDawn: false, days: 7, prayers: Prayer.allCases)
        // 27 and 28 are closed: 5 due each. Today counts only what is done.
        #expect(rates.byPrayer[.fajr] == CompletionRate(done: 3, due: 3))
        #expect(rates.byPrayer[.isha] == CompletionRate(done: 0, due: 2))
        #expect(rates.all == CompletionRate(done: 4, due: 11))
        let one = AfterPrayerStats.completionRates(history, today: today, beforeDawn: false, days: 1, prayers: Prayer.allCases)
        #expect(one.all == CompletionRate(done: 1, due: 1))
        // By default the dataset decides which prayers count: a prayer without azkar is never due.
        let byDefault = AfterPrayerStats.completionRates(history, today: today, beforeDawn: false, days: 7)
        let available = AzkarDataset.bundled.availableAfterPrayers
        #expect(byDefault.all == CompletionRate(
            done: available.reduce(0) { $0 + rates.byPrayer[$1]!.done }, due: available.reduce(0) { $0 + rates.byPrayer[$1]!.due }
        ))
    }

    @Test("After-prayer lifetime totals add every completed record and recitation")
    func afterPrayerLifetime() {
        let history: SessionHistory = [
            day("2026-10-27"): [.afterPrayer(.fajr): completed(33), .afterPrayer(.isha): started(4), .morning: completed(100)],
            day("2026-10-28"): [.afterPrayer(.fajr): completed(33)],
        ]
        let lifetime = AfterPrayerStats.lifetime(history)
        #expect(lifetime.completed[.fajr] == 2)
        #expect(lifetime.completed[.isha] == 0)
        #expect(lifetime.completedAll == 2)
        #expect(lifetime.recitations == 70)
        #expect(AzkarStats.lifetime(history, totals: [:], totalRecitations: 0).sessionsCompleted[.afterPrayer(.fajr)] == 2)
    }

    @Test("Tasbih totals add the presets and the free count, by day and for good")
    func tasbih() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        let history: TasbihHistory = [
            day("2026-10-20"): [TasbihRecord(preset: "subhanallah", count: 33, lastAt: nil)],
            day("2026-10-28"): [
                TasbihRecord(preset: "subhanallah", count: 100, lastAt: nil),
                TasbihRecord(preset: TasbihRecord.freeCount, count: 7, lastAt: nil),
                TasbihRecord(preset: "gone", count: 100, lastAt: nil),
            ],
            today: [TasbihRecord(preset: "alhamdulillah", count: 10, lastAt: nil)],
            day("2026-10-30"): [TasbihRecord(preset: "alhamdulillah", count: 0, lastAt: nil)],
        ]
        let lifetime = TasbihStats.lifetime(history, dataset: dataset)
        #expect(lifetime.count == 250)
        #expect(lifetime.free == 7)
        #expect(lifetime.byPreset.map(\.id) == ["subhanallah", "gone", "alhamdulillah"])
        #expect(lifetime.byPreset.map(\.recitations) == [133, 100, 10])
        #expect(lifetime.byPreset.first?.snippet == RecitationText.snippet(dataset.dhikr(id: "subhanallah")!.arabic))
        #expect(lifetime.byPreset[1].snippet == nil)
        #expect(lifetime.days == 3)
        #expect(TasbihStats.count(history, today: today, days: 7) == 217)
        #expect(TasbihStats.count(history, today: today, days: 1) == 10)
        #expect(TasbihStats.count(history, today: today, days: 0) == 0)
        #expect(TasbihStats.days(in: history, from: day("2026-10-28"), to: today).map(\.count) == [207, 10])
    }

    @Test("The weekly trends add bedtime, after-prayer, tasbih and fasting to the website's figures")
    func weeklyExtensions() {
        let history = TrackerHistory(
            sessions: [
                day("2026-10-26"): [.sleep: completed(), .afterPrayer(.fajr): completed(), .afterPrayer(.isha): completed(), .evening: completed()],
                day("2026-10-19"): [.sleep: started()],
            ],
            tasbih: [day("2026-10-27"): [TasbihRecord(preset: "free", count: 99, lastAt: nil)]],
            fasts: [
                day("2026-10-26"): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil),
                day("2026-10-29"): FastRecord(kind: .voluntary, status: .broken, loggedAt: nil),
            ]
        )
        // Weeks from Saturday: 2026-10-24 is the week under way.
        let weeks = TrackerStats.weeklyTotals(history, today: today, weekStart: 7, weeks: 2)
        #expect(weeks.map(\.start) == [day("2026-10-17"), day("2026-10-24")])
        #expect(weeks.map(\.days) == [7, 6])
        #expect(weeks[1].sleep == 1 && weeks[0].sleep == 0)
        #expect(weeks[1].afterPrayer == 2)
        #expect(weeks[1].azkar == 1)
        #expect(weeks[1].tasbih == 99)
        #expect(weeks[1].fasted == 1)
        #expect(TrackerStats.weekStart(of: today, weekStart: 2) == day("2026-10-26"))
        #expect(TrackerStats.weekStart(of: today, weekStart: 1) == day("2026-10-25"))
    }

    @Test("Anything recorded counts as a record: a tasbih count or a fast as well")
    func anyRecord() {
        #expect(!TrackerStats.hasAnyRecord(TrackerHistory(), today: today))
        #expect(TrackerStats.hasAnyRecord(TrackerHistory(tasbih: [today: [TasbihRecord(preset: "free", count: 1, lastAt: nil)]]), today: today))
        #expect(!TrackerStats.hasAnyRecord(TrackerHistory(tasbih: [day("2026-11-01"): [TasbihRecord(preset: "free", count: 1, lastAt: nil)]]), today: today))
        #expect(TrackerStats.hasAnyRecord(TrackerHistory(fasts: [today: FastRecord(kind: .qada, status: .fasted, loggedAt: nil)]), today: today))
        #expect(TrackerStats.hasAnyRecord(TrackerHistory(sessions: [today: [.afterPrayer(.asr): started()]]), today: today))
        let reading = QuranEntry(day: today, at: .now, kind: .read, fromPage: 0, toPage: 1)
        #expect(TrackerStats.hasAnyRecord(TrackerHistory(quran: [reading]), today: today))
        let later = QuranEntry(day: day("2026-11-01"), at: .now, kind: .khatmah, fromPage: 0, toPage: 0)
        #expect(!TrackerStats.hasAnyRecord(TrackerHistory(quran: [later]), today: today))
        #expect(TrackerStats.recordedDays(TrackerHistory(quran: [later, reading])) == [today, day("2026-11-01")])
        let days = TrackerStats.recordedDays(TrackerHistory(
            tasbih: [day("2026-10-02"): []], fasts: [day("2026-10-01"): FastRecord(kind: .qada, status: .fasted, loggedAt: nil)]
        ))
        #expect(days == [day("2026-10-01"), day("2026-10-02")])
    }
}
