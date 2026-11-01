import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite struct DuaMomentsTests {
    let noon = Date(timeIntervalSince1970: 1_800_000_000)
    var asr: Date { noon.addingTimeInterval(3 * 3600) }
    var maghrib: Date { noon.addingTimeInterval(6 * 3600) }

    private func moment(_ now: Date, _ today: DayKey, beforeDawn: Bool = false) -> DuaMoment? {
        DuaMoments.current(now: now, today: today, beforeDawn: beforeDawn, asr: asr, maghrib: maghrib)
    }

    @Test func aFridayBetweenAsrAndMaghrib() {
        let friday = DayKey(year: 2026, month: 11, day: 6)!
        #expect(moment(noon, friday) == nil)
        #expect(moment(asr, friday) == .fridayHour)
        #expect(moment(maghrib.addingTimeInterval(-1), friday) == .fridayHour)
        #expect(moment(maghrib, friday) == nil)
        #expect(moment(asr, friday.adding(days: 1)) == nil)
    }

    @Test func theLastTenNightsFromMaghribUntilFajr() {
        let days = HijriCalendar.civilDays(ofYear: 1448, month: HijriDate.ramadan)
        // The 21st night falls on the evening of the 20th.
        let evening = days[19]
        #expect(moment(noon, evening) == nil)
        #expect(moment(maghrib, evening) == .lastTenNight(21))
        #expect(moment(noon, evening.adding(days: 1), beforeDawn: true) == .lastTenNight(21))
        #expect(moment(maghrib, days[10]) == nil)
    }

    @Test func arafahUntilMaghrib() {
        let arafah = HijriCalendar.civilDays(ofYear: 1448, month: HijriDate.dhuAlHijjah)[8]
        #expect(moment(noon, arafah) == .arafah)
        #expect(moment(maghrib, arafah) == nil)
        #expect(moment(noon, arafah, beforeDawn: true) == nil)
    }

    @Test func withoutPrayerTimesOnlyArafahComes() {
        let arafah = HijriCalendar.civilDays(ofYear: 1448, month: HijriDate.dhuAlHijjah)[8]
        let friday = DayKey(year: 2026, month: 11, day: 6)!
        #expect(DuaMoments.current(now: noon, today: arafah, beforeDawn: false, asr: nil, maghrib: nil) == .arafah)
        #expect(DuaMoments.current(now: noon, today: friday, beforeDawn: false, asr: nil, maghrib: nil) == nil)
    }
}

@Suite struct DeedsExportTests {
    let today = DayKey(year: 2026, month: 11, day: 2)!
    let at = Date(timeIntervalSince1970: 1_793_000_000)
    let options = HistoryCSV.Options(locale: DisplayLocale(language: .en, arabicIndicDigits: false), timeZone: "UTC", hijriOffset: 0)

    @Test func aHistoryWithoutThemExportsAsItDid() {
        let csv = HistoryCSV.csv(TrackerHistory(), options: options)
        for header in ["Sadaqah", "Zakat", "Prayers made up", "My duas"] { #expect(!csv.contains(header)) }
    }

    @Test func eachIsWrittenOnItsDayAndTheWordsOfADuaStayOut() {
        let dua = UUID()
        let history = TrackerHistory(
            makeups: [PrayerMakeup(prayer: .fajr, day: today, at: at)],
            giving: [
                GivingEntry(kind: .sadaqah, day: today, at: at, amount: Decimal(string: "12.5"), currency: "USD", note: "Food"),
                GivingEntry(kind: .sadaqah, day: today, at: at),
            ],
            duaEntries: [DuaEntry(dua: dua, day: today, at: at, kind: .said), DuaEntry(dua: dua, day: today, at: at, kind: .answered)]
        )
        let lines = HistoryCSV.csv(history, options: options).components(separatedBy: "\r\n")
        #expect(lines[0].contains("Prayers made up from before,Sadaqah,Giving: notes,My duas: times said,My duas: answered"))
        #expect(!lines[0].contains("Zakat al-fitr"))
        #expect(lines[1].hasSuffix("1,12.5 USD; 1×,Food,1,1"))
    }

    @Test func theYearReviewCountsThemAndADayWithOnlyThemIsActive() {
        let history = TrackerHistory(
            makeups: [PrayerMakeup(prayer: .fajr, day: today, at: at)],
            giving: [GivingEntry(kind: .zakat, day: today, at: at, amount: 100, currency: "USD")],
            duaEntries: [DuaEntry(dua: UUID(), day: today, at: at, kind: .said)]
        )
        let year = HijriCalendar.date(of: today).year
        let review = HijriYearReview(hijriYear: year, offset: 0, today: today, history: history)
        #expect(review.activeDays == 1)
        #expect(review.madeUp == 1)
        #expect(review.giving.totals[.zakat]?.first?.amount == 100)
        #expect(review.duasSaid == 1)
        #expect(history.reviewYears(current: year - 1, today: today, offset: 0).contains(year))
    }
}
