import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// 1448 AH from the Umm al-Qura dates in IslamicOccasionsTests: Ramadan ends on 8 March 2027,
/// Eid al-Fitr is 9 March, 1 Dhu al-Hijjah is 7 May and Eid al-Adha 16 May.
@Suite("Takbir days")
struct TakbirDaysTests {
    private func day(_ text: String) -> DayKey { DayKey(text)! }

    @Test func dhulHijjahRunsToTheLastDayOfTashriq() {
        #expect(TakbirDays.season(on: day("2027-05-06"), afterMaghrib: true) == nil)
        #expect(TakbirDays.season(on: day("2027-05-07"), afterMaghrib: false) == .dhulHijjah(day: 1))
        #expect(TakbirDays.season(on: day("2027-05-16"), afterMaghrib: false) == .dhulHijjah(day: 10))
        #expect(TakbirDays.season(on: day("2027-05-19"), afterMaghrib: true) == .dhulHijjah(day: 13))
        #expect(TakbirDays.season(on: day("2027-05-20"), afterMaghrib: false) == nil)
    }

    @Test func eidAlFitrBeginsAtMaghribOnTheLastDayOfRamadan() {
        #expect(TakbirDays.season(on: day("2027-03-08"), afterMaghrib: false) == nil)
        #expect(TakbirDays.season(on: day("2027-03-08"), afterMaghrib: true) == .eidAlFitr)
        #expect(TakbirDays.season(on: day("2027-03-09"), afterMaghrib: false) == .eidAlFitr)
        #expect(TakbirDays.season(on: day("2027-03-10"), afterMaghrib: false) == nil)
        #expect(TakbirDays.season(on: day("2027-03-07"), afterMaghrib: true) == nil)
    }

    @Test func followsTheHijriOffset() {
        // A positive offset moves the Hijri date later, so the month begins a day sooner.
        #expect(TakbirDays.season(on: day("2027-05-06"), afterMaghrib: false, offset: 1) == .dhulHijjah(day: 1))
        #expect(TakbirDays.season(on: day("2027-05-08"), afterMaghrib: false, offset: -1) == .dhulHijjah(day: 1))
    }

    @Test func otherCountersAreKeptApartFromTasbih() {
        #expect(TasbihRecord.isOtherCounter(TasbihRecord.takbir))
        #expect(TasbihRecord.isTasbih(TasbihRecord.takbir))
        #expect(TasbihRecord.isOtherCounter("occasion-10-1") && !TasbihRecord.isTasbih("occasion-10-1"))
        #expect(!TasbihRecord.isOccasion("occasion-"))
        for lap in HajjLap.allCases {
            #expect(TasbihRecord.isOtherCounter(lap.rawValue) && !TasbihRecord.isTasbih(lap.rawValue))
        }
        let records = [
            TasbihRecord(preset: "subhanallah", count: 33, lastAt: nil),
            TasbihRecord(preset: TasbihRecord.takbir, count: 10, lastAt: nil),
            TasbihRecord(preset: "occasion-10-1", count: 2, lastAt: nil),
            TasbihRecord(preset: HajjLap.tawaf.rawValue, count: 7, lastAt: nil),
        ]
        #expect(TasbihStats.count(of: records) == 43)
        #expect(OccasionStats.count(of: records) == 2)
    }

    @Test func remindsOnlyWhenAskedOnTheTakbirDays() {
        var choices = SeasonReminderChoices()
        #expect(!SeasonReminders.plan(for: day("2027-05-07"), choices: choices).contains { $0.kind == .takbir })
        choices.takbir = true
        #expect(choices.isAnyOn)
        let dhulHijjah = SeasonReminders.plan(for: day("2027-05-07"), choices: choices).filter { $0.kind == .takbir }
        #expect(dhulHijjah.map(\.anchor) == [.fajr])
        let eidNight = SeasonReminders.plan(for: day("2027-03-08"), choices: choices).filter { $0.kind == .takbir }
        #expect(eidNight.map(\.anchor) == [.maghrib])
        let eidMorning = SeasonReminders.plan(for: day("2027-03-09"), choices: choices).filter { $0.kind == .takbir }
        #expect(eidMorning.map(\.anchor) == [.fajr])
        #expect(SeasonReminders.plan(for: day("2027-05-20"), choices: choices).allSatisfy { $0.kind != .takbir })
    }
}
