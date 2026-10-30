import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// The nights of Ramadan. 1447 has 30 days, from 18 February to 19 March 2026; 1448 has 29, from
/// 8 February to 8 March 2027.
@Suite("Ramadan's nights")
struct RamadanCalendarTests {
    @Test("A night leads into its day, so the first falls on the evening before Ramadan")
    func firstNight() throws {
        let first = try #require(RamadanCalendar.nights(hijriYear: 1447).first)
        #expect(first.number == 1 && first.id == 1)
        #expect(first.evening == day("2026-02-17"))
        #expect(first.isOdd && !first.isLastTen)
        // That evening is still Sha'ban.
        #expect(HijriCalendar.date(of: first.evening).month == HijriDate.ramadan - 1)
        #expect(!HijriCalendar.isRamadan(first.evening))
        #expect(RamadanCalendar.night(onEvening: day("2026-02-17")) == first)
    }

    @Test("Night 21 falls on the evening of the 20th")
    func lastTenBegins() throws {
        let nights = RamadanCalendar.nights(hijriYear: 1447)
        #expect(nights[19].number == 20 && !nights[19].isLastTen && !nights[19].isOdd)
        #expect(nights[20].number == 21 && nights[20].isLastTen && nights[20].isOdd)
        #expect(HijriCalendar.ramadanDay(of: nights[20].evening) == 20)
        #expect(nights.filter(\.isOdd).count == 15)
    }

    @Test("A Ramadan of 30 days has 30 nights, and none on the eve of the Eid", arguments: [
        (1447, 30, "2026-03-18", "2026-03-19", "2026-03-20"),
        (1448, 29, "2027-03-07", "2027-03-08", "2027-03-09"),
    ])
    func lastNight(year: Int, count: Int, lastEvening: String, eidEve: String, eid: String) throws {
        let nights = RamadanCalendar.nights(hijriYear: year)
        #expect(nights.count == count)
        #expect(nights.map(\.number) == Array(1...count))
        let last = try #require(nights.last)
        #expect(last.evening == day(lastEvening))
        #expect(RamadanCalendar.night(onEvening: day(lastEvening)) == last)
        #expect(RamadanCalendar.night(onEvening: day(eidEve)) == nil, "the evening of the last day is the night of the Eid")
        #expect(RamadanCalendar.night(onEvening: day(eid)) == nil)
    }

    @Test("The nights and the evenings agree, whatever the offset", arguments: [-2, -1, 0, 1, 2], [1447, 1448])
    func bothWays(offset: Int, year: Int) {
        let nights = RamadanCalendar.nights(hijriYear: year, offset: offset)
        for night in nights {
            #expect(RamadanCalendar.night(onEvening: night.evening, offset: offset) == night)
            #expect(HijriCalendar.ramadanDay(of: night.evening.adding(days: 1), offset: offset) == night.number)
        }
        let first = nights.first!.evening
        #expect(RamadanCalendar.night(onEvening: first.adding(days: -1), offset: offset) == nil)
        #expect(RamadanCalendar.night(onEvening: nights.last!.evening.adding(days: 1), offset: offset) == nil)
    }

    @Test("The offset moves the evenings", arguments: [-2, -1, 1, 2])
    func offsets(offset: Int) {
        let plain = RamadanCalendar.nights(hijriYear: 1447)
        let moved = RamadanCalendar.nights(hijriYear: 1447, offset: offset)
        #expect(moved.count == plain.count)
        for (shifted, night) in zip(moved, plain) {
            #expect(shifted.number == night.number)
            #expect(shifted.evening == night.evening.adding(days: -offset))
        }
    }

    @Test("Outside Ramadan, and in a year the calendar does not cover, there are no nights")
    func noNights() {
        #expect(RamadanCalendar.night(onEvening: day("2026-10-30")) == nil)
        #expect(RamadanCalendar.nights(hijriYear: 0).isEmpty)
    }
}

/// The figures of a year, seeded by hand.
@Suite("Ramadan's summary")
struct RamadanSummaryTests {
    /// Noon on `key`, for the entries of the log.
    static func at(_ key: String) -> Date { day(key).noonUTC }

    static func read(_ key: String, _ from: Int, _ to: Int) -> QuranEntry {
        QuranEntry(day: day(key), at: at(key), kind: .read, fromPage: from, toPage: to)
    }

    static func byHand(_ key: String) -> QuranEntry {
        QuranEntry(day: day(key), at: at(key), kind: .khatmah, fromPage: 0, toPage: 0)
    }

    static func tarawih(_ key: String, _ place: WorshipPlace? = nil, rakahs: Int? = nil) -> (DayKey, [SeasonDeed: SeasonRecord]) {
        (day(key), [.tarawih: SeasonRecord(deed: .tarawih, day: day(key), at: at(key), place: place, rakahs: rakahs)])
    }

    static func eidPrayer(_ key: String) -> (DayKey, [SeasonDeed: SeasonRecord]) {
        (day(key), [.eidPrayer: SeasonRecord(deed: .eidPrayer, day: day(key), at: at(key))])
    }

    static func seasons(_ records: (DayKey, [SeasonDeed: SeasonRecord])...) -> [DayKey: [SeasonDeed: SeasonRecord]] {
        Dictionary(records) { first, second in first.merging(second) { $1 } }
    }

    static func qiyam(_ keys: String...) -> PrayerHistory {
        Dictionary(uniqueKeysWithValues: keys.map { (day($0), DayPrayerRecord(sunnah: [.qiyam: at($0)])) })
    }

    func arafah(_ year: Int) -> DayKey {
        IslamicOccasions.dates(hijriYear: year).first { $0.occasion == .arafah }!.first
    }

    func eidAdha(_ year: Int) -> DayKey {
        IslamicOccasions.dates(hijriYear: year).first { $0.occasion == .eidAlAdha }!.first
    }

    @Test("A seeded year")
    func seededYear() {
        let history = TrackerHistory(
            prayers: Self.qiyam("2026-03-10"),
            fasts: [
                day("2026-02-18"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil),
                day("2026-02-19"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil),
                day("2026-02-20"): FastRecord(kind: .ramadan, status: .excused, loggedAt: nil),
                day("2026-02-21"): FastRecord(kind: .ramadan, status: .broken, loggedAt: nil),
                // Not Ramadan fasts, whatever day they are on.
                day("2026-02-22"): FastRecord(kind: .qada, status: .fasted, loggedAt: nil),
                day("2026-03-25"): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil),
                arafah(1447): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil),
            ],
            quran: [
                Self.read("2026-02-18", 0, 20),
                Self.read("2026-03-01", 20, 604),
                Self.read("2026-03-02", 0, 10),
                Self.read("2026-03-03", 10, 4), // a correction adds no pages
                Self.byHand("2026-03-04"),
            ],
            seasons: Self.seasons(
                Self.tarawih("2026-02-17", .masjid, rakahs: 20), // night 1, in Sha'ban
                Self.tarawih("2026-02-18", .masjid),
                Self.tarawih("2026-02-19", .home, rakahs: 8),
                Self.tarawih("2026-02-20"), // neither place nor rakahs
                Self.tarawih("2026-03-09", .home, rakahs: 11), // night 21
                Self.eidPrayer("2026-03-20"),
                Self.eidPrayer(eidAdha(1447).description)
            )
        )
        let summary = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(summary.year == 1447)
        #expect(summary.days == 30)
        #expect(summary.fasted == 2)
        #expect(summary.tarawih == 5)
        #expect(summary.tarawihAtMasjid == 2)
        #expect(summary.tarawihAtHome == 2)
        #expect(summary.tarawihRakahs == 39)
        #expect(summary.pagesRead == 614)
        #expect(summary.khatmahs == 2, "one finished in the app, one by hand")
        #expect(summary.lastTenStood == 2, "night 21 by its tarawih, night 22 by the qiyam of 10 March")
        #expect(summary.lastTenNights == 10)
        #expect(summary.eidFitrPrayed && summary.arafahFasted && summary.eidAdhaPrayed)
        #expect(summary.hasAnyRecord)
    }

    @Test("A year with nothing has only the calendar's figures")
    func emptyYear() {
        let summary = RamadanSummary(hijriYear: 1448, offset: 0, history: TrackerHistory())
        #expect(summary.year == 1448 && summary.days == 29 && summary.lastTenNights == 9)
        #expect(summary.fasted == 0 && summary.tarawih == 0 && summary.pagesRead == 0 && summary.khatmahs == 0 && summary.lastTenStood == 0)
        #expect(!summary.eidFitrPrayed && !summary.arafahFasted && !summary.eidAdhaPrayed)
        #expect(!summary.hasAnyRecord)
    }

    @Test("Reading outside the civil days of Ramadan is left out, the Eid among them")
    func readingOutsideRamadan() {
        let history = TrackerHistory(quran: [
            Self.read("2026-02-16", 0, 7), // Sha'ban
            Self.read("2026-02-17", 7, 20), // the evening of the first night, still Sha'ban
            Self.read("2026-02-18", 20, 25), // 1 Ramadan
            Self.read("2026-03-19", 25, 604), // 30 Ramadan, with a khatmah
            Self.read("2026-03-20", 0, 30), // the Eid
            Self.byHand("2026-03-20"),
            Self.byHand("2026-02-17"),
        ])
        let summary = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(summary.pagesRead == 584)
        #expect(summary.khatmahs == 1)
    }

    @Test("Reading on the eve of the Eid in a Ramadan of 29 days counts, the next day's does not")
    func readingOnTheLastDay() {
        let history = TrackerHistory(quran: [Self.read("2027-03-08", 0, 10), Self.read("2027-03-09", 10, 30)])
        #expect(RamadanSummary(hijriYear: 1448, offset: 0, history: history).pagesRead == 10)
    }

    @Test("A tarawih is counted on its evening, and none falls on the eve of the Eid")
    func tarawihOnItsEvening() {
        let history = TrackerHistory(seasons: Self.seasons(
            Self.tarawih("2026-02-16", .home), // the evening before the first night
            Self.tarawih("2026-03-18", .masjid, rakahs: 8), // the last night
            Self.tarawih("2026-03-19", .masjid, rakahs: 8) // the eve of the Eid
        ))
        let summary = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(summary.tarawih == 1 && summary.tarawihAtMasjid == 1 && summary.tarawihRakahs == 8)
    }

    @Test("The last ten stand on tarawih")
    func lastTenFromTarawih() {
        let history = TrackerHistory(seasons: Self.seasons(Self.tarawih("2026-03-09"), Self.tarawih("2026-03-18")))
        #expect(RamadanSummary(hijriYear: 1447, offset: 0, history: history).lastTenStood == 2)
    }

    @Test("The last ten stand on the night prayer")
    func lastTenFromQiyam() {
        let history = TrackerHistory(prayers: Self.qiyam("2026-03-09", "2026-03-18"))
        let summary = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(summary.lastTenStood == 2)
        #expect(summary.tarawih == 0)
        #expect(summary.hasAnyRecord)
    }

    @Test("A night with both is one night")
    func lastTenFromBoth() {
        let history = TrackerHistory(
            prayers: Self.qiyam("2026-03-09", "2026-03-10"),
            seasons: Self.seasons(Self.tarawih("2026-03-10"), Self.tarawih("2026-03-11"))
        )
        #expect(RamadanSummary(hijriYear: 1447, offset: 0, history: history).lastTenStood == 3)
    }

    @Test("The night prayer ticked past midnight is filed under the evening, so it stands for that night alone")
    func qiyamAfterMidnight() {
        // Ticked at 02:00 on 10 March, before Fajr: `Night.sunnahDay` files it under the 9th.
        let afterMidnight = ISO8601DateFormatter().date(from: "2026-03-10T02:00:00Z")!
        let history = TrackerHistory(prayers: [day("2026-03-09"): DayPrayerRecord(sunnah: [.qiyam: afterMidnight])])
        let summary = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(summary.lastTenStood == 1)
    }

    @Test("Only the last ten count, and the eve of the Eid is not one of them")
    func outsideTheLastTen() {
        let history = TrackerHistory(
            prayers: Self.qiyam("2026-03-08", "2026-03-19"), // the evenings of nights 20 and of the Eid
            seasons: Self.seasons(Self.tarawih("2026-03-08"))
        )
        #expect(RamadanSummary(hijriYear: 1447, offset: 0, history: history).lastTenStood == 0)
    }

    @Test("A Ramadan of 29 days has nine of the last ten", arguments: [(1447, 10), (1448, 9)])
    func lastTenNights(year: Int, nights: Int) {
        let evenings = RamadanCalendar.nights(hijriYear: year).filter(\.isLastTen).map(\.evening)
        let history = TrackerHistory(prayers: Dictionary(uniqueKeysWithValues: evenings.map { ($0, DayPrayerRecord(sunnah: [.qiyam: $0.noonUTC])) }))
        let summary = RamadanSummary(hijriYear: year, offset: 0, history: history)
        #expect(summary.lastTenNights == nights && summary.lastTenStood == nights)
    }

    @Test("Each Eid's prayer and Arafah's fast are looked for on their own day")
    func eidsAndArafah() {
        let history = TrackerHistory(
            fasts: [arafah(1447).adding(days: -1): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil)],
            seasons: Self.seasons(Self.eidPrayer("2026-03-21"), Self.eidPrayer(eidAdha(1447).adding(days: 1).description))
        )
        let summary = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(!summary.eidFitrPrayed && !summary.arafahFasted && !summary.eidAdhaPrayed)
        #expect(!summary.hasAnyRecord)

        let broken = TrackerHistory(fasts: [arafah(1447): FastRecord(kind: .voluntary, status: .broken, loggedAt: nil)])
        #expect(!RamadanSummary(hijriYear: 1447, offset: 0, history: broken).arafahFasted)
    }

    @Test("The offset moves the nights, the days and the Eids with it")
    func offset() {
        let history = TrackerHistory(
            quran: [Self.read("2026-02-17", 0, 10)],
            seasons: Self.seasons(Self.tarawih("2026-02-16", .masjid), Self.eidPrayer("2026-03-19"))
        )
        let plain = RamadanSummary(hijriYear: 1447, offset: 0, history: history)
        #expect(plain.tarawih == 0 && plain.pagesRead == 0 && !plain.eidFitrPrayed)
        let moved = RamadanSummary(hijriYear: 1447, offset: 1, history: history)
        #expect(moved.tarawih == 1 && moved.pagesRead == 10 && moved.eidFitrPrayed)
    }

    @Test("It counts the same fasts as the fasting figures")
    func sameFastsAsTheFastingFigures() {
        // Filed on the last day of Ramadan, then the offset moved that day to the Eid: still a Ramadan fast.
        let fasts: FastingHistory = [
            day("2026-03-19"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil),
            day("2026-03-18"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil),
        ]
        let summary = RamadanSummary(hijriYear: 1447, offset: 1, history: TrackerHistory(fasts: fasts))
        let figures = FastingStats.ramadan(fasts, today: day("2026-04-01"), offset: 1)
        #expect(figures.year == 1447)
        #expect(summary.fasted == 2 && summary.fasted == figures.fasted)
    }
}

/// The khatmah goal. 1 Ramadan 1447 is 18 February 2026, with 30 days to go, the 30th 19 March.
@Suite("Ramadan's khatmah goal")
struct RamadanGoalTests {
    let firstDay = day("2026-02-18")
    let lastDay = day("2026-03-19")

    func read(_ key: String, _ from: Int, _ to: Int) -> QuranEntry { RamadanSummaryTests.read(key, from, to) }

    @Test("No goal, and days outside Ramadan, have no answer")
    func noAnswer() {
        #expect(RamadanGoal.pagesPerDay(goal: 0, today: firstDay, offset: 0, quran: []) == nil)
        #expect(RamadanGoal.pagesPerDay(goal: -1, today: firstDay, offset: 0, quran: []) == nil)
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: firstDay.adding(days: -1), offset: 0, quran: []) == nil)
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay.adding(days: 1), offset: 0, quran: []) == nil, "the Eid")
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: day("2026-10-30"), offset: 0, quran: []) == nil)
    }

    @Test("Spread over the days left, today included, and rounded up")
    func spread() {
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: firstDay, offset: 0, quran: []) == 21, "604 / 30 is 20.1")
        #expect(RamadanGoal.pagesPerDay(goal: 3, today: firstDay, offset: 0, quran: []) == 61, "1812 / 30 is 60.4")
        // Exactly 600 left over 30 days needs no rounding.
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: firstDay, offset: 0, quran: [read("2026-02-10", 0, 4)]) == 20)
        // Ten days left, today one of them.
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay.adding(days: -9), offset: 0, quran: []) == 61)
    }

    @Test("In a Ramadan of 29 days the end comes a day sooner")
    func twentyNineDays() {
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: day("2027-02-08"), offset: 0, quran: []) == 21, "604 / 29 is 20.8")
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: day("2027-03-08"), offset: 0, quran: []) == 604)
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: day("2027-03-09"), offset: 0, quran: []) == nil)
    }

    @Test("On the last day all that is left is today's")
    func lastDayOfRamadan() {
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: [read("2026-03-01", 0, 600)]) == 4)
        #expect(RamadanGoal.pagesPerDay(goal: 2, today: lastDay, offset: 0, quran: []) == 1208)
    }

    @Test("What was read today already counts")
    func readToday() {
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: [read("2026-03-19", 0, 600)]) == 4)
    }

    @Test("The goal met is 0, and stays 0")
    func met() {
        let finished = [read("2026-03-01", 0, 604)]
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: day("2026-03-02"), offset: 0, quran: finished) == 0)
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: finished + [read("2026-03-03", 0, 5)]) == 0)
        let byHand = [RamadanSummaryTests.byHand("2026-03-01")]
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: day("2026-03-02"), offset: 0, quran: byHand) == 0)
    }

    @Test("Khatmahs finished in Ramadan take the goal down, those before it do not")
    func whichKhatmahsCount() {
        let inRamadan = [read("2026-02-20", 0, 604), read("2026-02-21", 0, 100)]
        #expect(RamadanGoal.pagesPerDay(goal: 2, today: lastDay, offset: 0, quran: inRamadan) == 504)
        let before = [read("2026-02-10", 0, 604)]
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: before) == 604)
    }

    @Test("A khatmah under way when Ramadan began needs only what is left of it")
    func underWay() {
        let entries = [read("2026-02-10", 0, 304)]
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: entries) == 300)
        // And it counts as finished in Ramadan, as the summary counts it.
        let finished = entries + [read("2026-03-01", 304, 604)]
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: finished) == 0)
        #expect(RamadanSummary(hijriYear: 1447, offset: 0, history: TrackerHistory(quran: finished)).khatmahs == 1)
    }

    @Test("A correction backwards leaves more to read")
    func correction() {
        let entries = [read("2026-03-01", 0, 500), read("2026-03-02", 500, 400)]
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 0, quran: entries) == 204)
    }

    @Test("The offset moves Ramadan's days")
    func offset() {
        // With offset 1 the last day is a day earlier: the 19th is the Eid.
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay, offset: 1, quran: []) == nil)
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: lastDay.adding(days: -1), offset: 1, quran: []) == 604)
        #expect(RamadanGoal.pagesPerDay(goal: 1, today: firstDay.adding(days: -1), offset: 1, quran: []) == 21)
    }
}

@Suite("The years of Ramadan")
struct RamadanYearsTests {
    @Test("The current year is always there")
    func current() {
        #expect(TrackerHistory().ramadanYears(current: 1448, offset: 0) == [1448])
    }

    @Test("Newest first, each year once")
    func newestFirst() {
        let history = TrackerHistory(
            fasts: [day("2025-03-05"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil)], // 1446
            quran: [RamadanSummaryTests.read("2023-04-01", 0, 3)], // 1444
            seasons: RamadanSummaryTests.seasons(RamadanSummaryTests.tarawih("2026-02-17"), RamadanSummaryTests.tarawih("2026-02-18"))
        )
        #expect(history.ramadanYears(current: 1448, offset: 0) == [1448, 1447, 1446, 1444])
    }

    @Test("A year with nothing in its summary is left out")
    func nothingInTheSummary() {
        let history = TrackerHistory(
            prayers: RamadanSummaryTests.qiyam("2025-03-05"), // a night prayer, not in the last ten of 1446
            fasts: [
                day("2024-01-10"): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil), // Rajab 1445
                day("2023-04-01"): FastRecord(kind: .ramadan, status: .excused, loggedAt: nil), // not fasted, 1444
            ],
            quran: [RamadanSummaryTests.read("2022-10-01", 0, 9)] // Rabi' 1444, outside Ramadan
        )
        #expect(history.ramadanYears(current: 1448, offset: 0) == [1448])
    }

    @Test("Each kind of thing in the summary brings its year")
    func everyFigure() {
        let years = { (history: TrackerHistory) in history.ramadanYears(current: 1448, offset: 0) }
        #expect(years(TrackerHistory(prayers: RamadanSummaryTests.qiyam("2026-03-09"))) == [1448, 1447])
        #expect(years(TrackerHistory(quran: [RamadanSummaryTests.byHand("2026-03-09")])) == [1448, 1447])
        #expect(years(TrackerHistory(seasons: RamadanSummaryTests.seasons(RamadanSummaryTests.eidPrayer("2026-03-20")))) == [1448, 1447])
        let adha = IslamicOccasions.dates(hijriYear: 1447).first { $0.occasion == .eidAlAdha }!.first
        #expect(years(TrackerHistory(seasons: RamadanSummaryTests.seasons(RamadanSummaryTests.eidPrayer(adha.description)))) == [1448, 1447])
        let arafah = adha.adding(days: -1)
        #expect(years(TrackerHistory(fasts: [arafah: FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil)])) == [1448, 1447])
    }

    @Test("The first night, though it falls in Sha'ban, belongs to its Ramadan's year")
    func firstNight() {
        let history = TrackerHistory(seasons: RamadanSummaryTests.seasons(RamadanSummaryTests.tarawih("2026-02-17")))
        #expect(history.ramadanYears(current: 1447, offset: 0) == [1447])
        #expect(history.ramadanYears(current: 1448, offset: 0) == [1448, 1447])
    }
}

@Suite("Season records in the tracker's figures")
struct SeasonTrackerStatsTests {
    let today = day("2026-03-20")

    @Test("They are records")
    func records() {
        let history = TrackerHistory(seasons: RamadanSummaryTests.seasons(RamadanSummaryTests.eidPrayer("2026-03-20")))
        #expect(TrackerStats.hasAnyRecord(history, today: today))
        #expect(TrackerStats.recordedDays(history) == [today])
    }

    @Test("Nothing up to today, or an empty day, is none")
    func none() {
        let future = TrackerHistory(seasons: RamadanSummaryTests.seasons(RamadanSummaryTests.eidPrayer("2026-03-21")))
        #expect(!TrackerStats.hasAnyRecord(future, today: today))
        #expect(TrackerStats.recordedDays(future) == [day("2026-03-21")], "an export leaves nothing out")
        let empty = TrackerHistory(seasons: [today: [:]])
        #expect(!TrackerStats.hasAnyRecord(empty, today: today))
        #expect(TrackerStats.recordedDays(empty).isEmpty)
    }
}
