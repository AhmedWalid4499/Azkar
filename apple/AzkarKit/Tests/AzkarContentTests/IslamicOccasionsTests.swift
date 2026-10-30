import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite("Islamic occasions")
struct IslamicOccasionsTests {
    private func day(_ text: String) -> DayKey { DayKey(text)! }

    private func occasion(_ occasion: IslamicOccasion, year: Int, offset: Int = 0) -> OccasionDates {
        IslamicOccasions.dates(hijriYear: year, offset: offset).first { $0.occasion == occasion }!
    }

    /// Dates from `Intl`'s `islamic-umalqura` calendar in Node, worked out apart from Foundation.
    @Test("Dates match the Umm al-Qura calendar", arguments: [
        (1448, "2026-06-16", "2026-06-25", "2027-02-08", "2027-03-08", "2027-03-09", "2027-05-07", "2027-05-15", "2027-05-16"),
        (1449, "2027-06-06", "2027-06-15", "2028-01-28", "2028-02-25", "2028-02-26", "2028-04-26", "2028-05-04", "2028-05-05"),
        (1450, "2028-05-25", "2028-06-03", "2029-01-16", "2029-02-13", "2029-02-14", "2029-04-15", "2029-04-23", "2029-04-24"),
    ])
    func dates(year: Int, newYear: String, ashura: String, ramadanFirst: String, ramadanLast: String, fitr: String, dhulHijjah: String, arafah: String, adha: String) {
        #expect(occasion(.hijriNewYear, year: year).first == day(newYear))
        #expect(occasion(.ashura, year: year).first == day(ashura))
        #expect(occasion(.ramadan, year: year).first == day(ramadanFirst))
        #expect(occasion(.ramadan, year: year).last == day(ramadanLast))
        #expect(occasion(.eidAlFitr, year: year).first == day(fitr))
        #expect(occasion(.dhulHijjahDays, year: year).first == day(dhulHijjah))
        #expect(occasion(.dhulHijjahDays, year: year).last == day(adha))
        #expect(occasion(.arafah, year: year).first == day(arafah))
        #expect(occasion(.eidAlAdha, year: year).first == day(adha))
    }

    @Test("Occasions come in the order of the year")
    func order() {
        let dates = IslamicOccasions.dates(hijriYear: 1448)
        #expect(dates.map(\.occasion) == IslamicOccasion.allCases)
        #expect(dates.map(\.first) == dates.map(\.first).sorted { $0.days(to: $1) > 0 })
    }

    @Test("A year outside the calendar has no occasions")
    func unknownYear() {
        #expect(IslamicOccasions.dates(hijriYear: 0).isEmpty)
    }

    @Test("The offset moves every date", arguments: [-2, -1, 1, 2])
    func offset(offset: Int) {
        let moved = IslamicOccasions.dates(hijriYear: 1448, offset: offset)
        for (plain, shifted) in zip(IslamicOccasions.dates(hijriYear: 1448), moved) {
            #expect(shifted.first == plain.first.adding(days: -offset))
            #expect(shifted.last == plain.last.adding(days: -offset))
        }
    }

    @Test("Quiet for most of the year")
    func quiet() {
        #expect(IslamicOccasions.notice(on: day("2026-10-30")) == nil)
        #expect(IslamicOccasions.notice(on: day("2027-01-28")) == nil)
    }

    @Test("Ramadan is mentioned ten days ahead, then leaves it to its own card")
    func ramadan() {
        let dates = occasion(.ramadan, year: 1448)
        #expect(IslamicOccasions.notice(on: day("2027-01-29")) == .approaching(dates, inDays: 10))
        #expect(IslamicOccasions.notice(on: day("2027-02-07")) == .approaching(dates, inDays: 1))
        #expect(IslamicOccasions.notice(on: day("2027-02-08")) == nil)
        #expect(IslamicOccasions.notice(on: day("2027-03-01")) == nil)
    }

    @Test("The Eids are mentioned three days ahead and on the day")
    func eids() {
        let fitr = occasion(.eidAlFitr, year: 1448)
        #expect(IslamicOccasions.notice(on: day("2027-03-05")) == nil)
        #expect(IslamicOccasions.notice(on: day("2027-03-06")) == .approaching(fitr, inDays: 3))
        #expect(IslamicOccasions.notice(on: day("2027-03-09")) == .today(fitr))
        #expect(IslamicOccasions.notice(on: day("2027-03-10")) == nil)
        let adha = occasion(.eidAlAdha, year: 1448)
        #expect(IslamicOccasions.notice(on: day("2027-05-15")) == .approaching(adha, inDays: 1))
        #expect(IslamicOccasions.notice(on: day("2027-05-16")) == .today(adha))
        #expect(IslamicOccasions.notice(on: day("2027-05-17")) == nil)
    }

    @Test("Dhu al-Hijjah: its first days run until Arafah comes close")
    func dhulHijjah() {
        let days = occasion(.dhulHijjahDays, year: 1448)
        let arafah = occasion(.arafah, year: 1448)
        #expect(IslamicOccasions.notice(on: day("2027-05-04")) == .approaching(days, inDays: 3))
        #expect(IslamicOccasions.notice(on: day("2027-05-07")) == .running(days, day: 1))
        #expect(IslamicOccasions.notice(on: day("2027-05-11")) == .running(days, day: 5))
        #expect(IslamicOccasions.notice(on: day("2027-05-12")) == .approaching(arafah, inDays: 3))
        #expect(IslamicOccasions.notice(on: day("2027-05-14")) == .approaching(arafah, inDays: 1))
    }

    @Test("The new year is found from the end of the year before")
    func newYear() {
        let next = occasion(.hijriNewYear, year: 1449)
        #expect(IslamicOccasions.notice(on: day("2027-06-03")) == .approaching(next, inDays: 3))
        #expect(IslamicOccasions.notice(on: day("2027-06-06")) == .today(next))
        let ashura = occasion(.ashura, year: 1449)
        #expect(IslamicOccasions.notice(on: day("2027-06-14")) == .approaching(ashura, inDays: 1))
        #expect(IslamicOccasions.notice(on: day("2027-06-15")) == nil)
    }

    @Test("Notices follow the offset")
    func noticeOffset() {
        let fitr = occasion(.eidAlFitr, year: 1448, offset: -1)
        #expect(IslamicOccasions.notice(on: day("2027-03-10"), offset: -1) == .today(fitr))
    }

    @Test("Day numbers count from the first day")
    func dayNumbers() {
        let dates = occasion(.ramadan, year: 1448)
        #expect(dates.dayNumber(of: dates.first) == 1)
        #expect(dates.dayNumber(of: dates.last) == dates.dayCount)
        #expect(dates.dayNumber(of: dates.last.adding(days: 1)) == nil)
        #expect(dates.dayNumber(of: dates.first.adding(days: -1)) == nil)
    }

    @Test("A range of days is written in the reader's language")
    func dayRange() {
        let first = HijriDate(year: 1448, month: 9, day: 1)
        let last = HijriDate(year: 1448, month: 9, day: 29)
        #expect(HijriFormat.dayRange(first, last, locale: .english) == "Ramadan 1–29")
        #expect(HijriFormat.dayRange(first, last, locale: .arabic) == "١–٢٩ رمضان")
    }
}
