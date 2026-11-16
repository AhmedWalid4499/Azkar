import AzkarCore
import AzkarContent
import Foundation
import Testing

@Suite struct HifzMapTests {
    let today = day("2026-11-16")

    /// The table `QuranLayout` keeps is the bundled metadata's, surah by surah and juz by juz.
    @Test func theLayoutTableIsTheMushafs() {
        let mushaf = QuranMushaf.bundled
        #expect(mushaf.suras.map(\.ayahCount) == QuranLayout.ayahCounts)
        #expect(mushaf.juz.map { AyahRef(sura: $0.sura, ayah: $0.ayah) } == QuranLayout.juzStarts)
        #expect(mushaf.ayat.count == QuranLayout.ayahTotal)
        // Every page's ayat, in the page index, are the mushaf's.
        let index = QuranPageIndex.bundled
        for page in [1, 2, 3, 50, 293, 582, 604] {
            let ayat = mushaf.ayat(onPage: page)
            let indexes = index.ayahIndexes(ofPage: page)
            #expect(indexes.count == ayat.count)
            #expect(QuranLayout.ref(at: indexes.lowerBound) == AyahRef(sura: ayat.first!.sura, ayah: ayat.first!.number))
        }
        #expect(QuranMushaf.pages.reduce(0) { $0 + index.ayahIndexes(ofPage: $1).count } == QuranLayout.ayahTotal)
        #expect(index.pages(ofJuz: 1) == 1...21)
        #expect(index.pages(ofJuz: 30) == 582...604)
    }

    @Test func halfOfAlBaqarahReviewedWeaklyShowsDueOnItsPages() throws {
        let entries = [
            HifzEntry(span: AyahSpan(sura: 2, from: 1, to: 141), day: day("2026-11-10"), at: Date(timeIntervalSince1970: 1), kind: .memorised),
            HifzEntry(span: AyahSpan(sura: 2, from: 1, to: 141), day: day("2026-11-14"), at: Date(timeIntervalSince1970: 2), kind: .reviewed, strength: .weak),
            HifzEntry(sura: 114, day: day("2026-11-16"), at: Date(timeIntervalSince1970: 3), kind: .memorised),
        ]
        let map = HifzMap(progress: HifzProgress(entries: entries), today: today)
        let juz1 = map.juz[0]
        // Juz 1 is al-Fatiha and al-Baqarah to 141: only al-Fatiha is left out.
        #expect(juz1.held == 141 && juz1.total == 148 && juz1.isDue && juz1.standing == .weak)
        #expect(map.pages[0].held == 0 && map.pages[0].standing == nil)
        #expect(map.pages[1].isComplete && map.pages[1].isDue)
        #expect(map.pages(ofJuz: 1).count == 21)
        let last = try #require(map.pages.last)
        #expect(last.number == 604 && last.held == 6 && last.total == 15 && !last.isDue && last.standing == .unrated)
        #expect(map.pagesHeld == 20)
        #expect(map.juzHeld == 0)
    }

    @Test func theReviewReminderComesOnlyOnDaysSomethingIsDue() {
        var choices = SeasonReminderChoices()
        #expect(SeasonReminders.plan(for: today, choices: choices, hifzDue: { _ in true }).isEmpty)
        choices.hifzReview = true
        #expect(choices.isAnyOn)
        #expect(SeasonReminders.plan(for: today, choices: choices, hifzDue: { _ in false }).isEmpty)
        let reminders = SeasonReminders.plan(for: today, choices: choices, hifzDue: { $0 == day("2026-11-16") })
        #expect(reminders == [SeasonReminder(kind: .hifzReview, anchor: .fajr, offsetMinutes: SeasonReminderChoices.hifzReviewDelayMinutes)])
    }

    @Test func theExportCarriesRangesStrengthAndPlans() {
        let entries = [
            HifzEntry(span: AyahSpan(sura: 2, from: 1, to: 143), day: day("2026-11-10"), at: Date(timeIntervalSince1970: 1_794_300_000), kind: .memorised),
            HifzEntry(span: AyahSpan(sura: 2, from: 1, to: 143), day: day("2026-11-14"), at: Date(timeIntervalSince1970: 1_794_600_000), kind: .reviewed, strength: .weak),
            HifzEntry(sura: 67, day: day("2026-11-14"), at: Date(timeIntervalSince1970: 1_794_600_001), kind: .reviewed),
        ]
        let plan = HifzPlan(createdAt: Date(timeIntervalSince1970: 1_794_700_000), start: day("2026-11-16"), target: .juz(30),
                            targetDay: day("2027-02-01"), dailyAyat: 8)
        let history = TrackerHistory(hifz: entries, hifzPlans: [plan])
        let rows = parseCSV(HistoryCSV.csv(history, options: .init(locale: .english, timeZone: "UTC", hijriOffset: 0)))
        #expect(rows[0].suffix(6) == ["Memorisation: surahs memorised", "Memorisation: surahs reviewed", "Memorisation: ayat memorised",
                                      "Memorisation: ayat reviewed", "Memorisation: details", "Memorisation: plan started"])
        #expect(rows.map { $0[0] } == ["Date", "2026-11-10", "2026-11-14", "2026-11-16"])
        #expect(rows[1].suffix(6) == ["1", "0", "143", "0", "2:1-143 memorised", ""])
        #expect(rows[2].suffix(6) == ["0", "2", "0", "173", "2:1-143 reviewed (weak); 67 reviewed", ""])
        #expect(rows[3].suffix(6) == ["", "", "", "", "", "juz 30 by 2027-02-01, 8 ayat a day"])

        let arabic = parseCSV(HistoryCSV.csv(history, options: .init(locale: .arabic, timeZone: "UTC", hijriOffset: 0)))
        #expect(arabic[2].suffix(2).first == "2:1-143 رُوجعت (ضعيفة); 67 رُوجعت")
    }

    @Test func theYearReviewCountsAyatWeakReviewsAndPlans() {
        let entries = [
            HifzEntry(span: AyahSpan(sura: 2, from: 1, to: 143), day: day("2026-11-10"), at: Date(timeIntervalSince1970: 1), kind: .memorised),
            HifzEntry(span: AyahSpan(sura: 2, from: 1, to: 143), day: day("2026-11-14"), at: Date(timeIntervalSince1970: 2), kind: .reviewed, strength: .weak),
        ]
        let plan = HifzPlan(createdAt: .now, start: day("2026-11-16"), target: .sura(2), targetDay: day("2026-12-31"), dailyAyat: 4)
        let history = TrackerHistory(hifz: entries, hifzPlans: [plan])
        let year = HijriCalendar.date(of: today, offset: 0).year
        let review = HijriYearReview(hijriYear: year, offset: 0, today: today, history: history)
        #expect(review.ayatMemorised == 143 && review.ayatReviewed == 143 && review.weakReviews == 1 && review.plansStarted == 1)
        #expect(review.activeDays == 3)
    }
}
