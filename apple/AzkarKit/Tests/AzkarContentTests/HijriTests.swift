import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite("The Hijri calendar")
struct HijriTests {
    struct Formatted: Decodable {
        var key: String
        var offset: Int
        var text: [String]
    }

    struct Span: Decodable {
        struct Text: Decodable {
            var from: String
            var to: String?
        }

        var year, month, offset: Int
        var spans: [Text]
    }

    struct Fixture: Decodable {
        var locales: [String]
        var monthStarts: [[AnyCodable]]
        var formatted: [Formatted]
        var spans: [Span]
    }

    static func load() throws -> Fixture { try Fixtures.load(Fixture.self, "hijri.json") }

    /// The website's locales, in the fixture's order: `en`, `ar-u-nu-arab`, `ar-u-nu-latn`.
    static let locales: [DisplayLocale] = [.english, .arabic, .arabicWesternDigits]

    @Test("Every day from 1356 to 1500 AH falls on the Umm al-Qura date the website's Intl gives")
    func everyDayMatchesIntl() throws {
        let fixture = try Self.load()
        #expect(fixture.locales == ["en", "ar-u-nu-arab", "ar-u-nu-latn"])
        let starts = fixture.monthStarts.map { (day($0[0].string!), $0[1].int!, $0[2].int!) }
        #expect(starts.count > 1700)
        var checked = 0
        for (start, next) in zip(starts, starts.dropFirst()) {
            let length = start.0.days(to: next.0)
            #expect((29...30).contains(length), "\(start.0)")
            for offset in 0..<length {
                let hijri = HijriCalendar.date(of: start.0.adding(days: offset))
                guard hijri == HijriDate(year: start.1, month: start.2, day: offset + 1) else {
                    Issue.record("\(start.0.adding(days: offset)) is \(hijri), the website says \(start.1)-\(start.2)-\(offset + 1)")
                    return
                }
                checked += 1
            }
        }
        #expect(checked > 50_000)
    }

    @Test("Formatted dates read as the website writes them, with the offset, in both languages and digits")
    func formattedDates() throws {
        for expected in try Self.load().formatted {
            for (locale, text) in zip(Self.locales, expected.text) {
                #expect(HijriFormat.full(day(expected.key), offset: expected.offset, locale: locale) == text, "\(expected.key) \(expected.offset)")
            }
        }
    }

    @Test("A Gregorian month's Hijri span reads as the website's hijriSpanOfMonth")
    func spans() throws {
        for expected in try Self.load().spans {
            let month = GregorianMonth(year: expected.year, month: expected.month)
            for (locale, text) in zip(Self.locales, expected.spans) {
                let span = HijriFormat.span(of: month, offset: expected.offset, locale: locale)
                #expect(span == HijriSpan(from: text.from, to: text.to), "\(month) \(expected.offset)")
            }
        }
    }

    @Test("A positive offset moves the Hijri date later")
    func offset() {
        let key = day("2026-10-29")
        let base = HijriCalendar.date(of: key)
        #expect(HijriCalendar.date(of: key, offset: 1) == HijriCalendar.date(of: key.adding(days: 1)))
        #expect(HijriCalendar.date(of: key, offset: -2) == HijriCalendar.date(of: key.adding(days: -2)))
        #expect(base == HijriDate(year: 1448, month: 5, day: 18))
        #expect(HijriCalendar.offsetRange == -2...2)
    }

    @Test("The other formats: month and year, year alone, day and month")
    func otherFormats() {
        let date = HijriDate(year: 1448, month: 9, day: 3)
        #expect(HijriFormat.monthAndYear(date, locale: .english) == "Ramadan 1448 AH")
        #expect(HijriFormat.year(date, locale: .english) == "1448 AH")
        #expect(HijriFormat.dayAndMonth(date, locale: .english) == "Ramadan 3")
        #expect(HijriFormat.dayAndMonth(date, locale: .arabicWesternDigits) == "3 \(HijriFormat.monthName(9, language: .ar))")
        #expect(HijriFormat.year(date, locale: .arabic) == "\(DisplayLocale.arabic.number(1448)) هـ")
        #expect(HijriFormat.monthName(12, language: .en) == "Dhuʻl-Hijjah")
    }

    @Test("A Hijri month's civil days, as the offset places them")
    func civilDays() {
        let ramadan = HijriCalendar.civilDays(ofYear: 1447, month: 9)
        #expect(ramadan.first == day("2026-02-18"))
        #expect(ramadan.count == 30)
        #expect(ramadan.allSatisfy { HijriCalendar.isRamadan($0) })
        #expect(!HijriCalendar.isRamadan(ramadan.first!.adding(days: -1)))
        let later = HijriCalendar.civilDays(ofYear: 1447, month: 9, offset: -1)
        #expect(later.first == day("2026-02-19"))
        #expect(later.allSatisfy { HijriCalendar.ramadanDay(of: $0, offset: -1) != nil })
        #expect(HijriCalendar.civilDays(ofYear: 1447, month: 13).isEmpty)
        #expect(HijriCalendar.monthStart(of: day("2026-03-01")) == day("2026-02-18"))
        #expect(HijriCalendar.ramadanDay(of: day("2026-03-01")) == 12)
    }

    @Test("Gregorian months know their days")
    func gregorianMonths() {
        #expect(GregorianMonth(year: 2024, month: 2).dayCount == 29)
        #expect(GregorianMonth(year: 2026, month: 1).adding(months: -1) == GregorianMonth(year: 2025, month: 12))
        #expect(GregorianMonth(year: 2026, month: 12).adding(months: 1) == GregorianMonth(year: 2027, month: 1))
        #expect(GregorianMonth(year: 2026, month: 10).lastDay == day("2026-10-31"))
        #expect(GregorianMonth(day("2026-10-29")).contains(day("2026-10-01")))
    }
}
