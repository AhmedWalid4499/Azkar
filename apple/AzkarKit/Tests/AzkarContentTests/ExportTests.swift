import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// Splits a CSV file (RFC 4180, CRLF rows, a byte order mark first) into its fields.
func parseCSV(_ text: String) -> [[String]] {
    var rows: [[String]] = []
    var row: [String] = []
    var field = ""
    var quoted = false
    var scalars = Array(text.unicodeScalars)
    if scalars.first == "\u{FEFF}" { scalars.removeFirst() }
    var index = 0
    while index < scalars.count {
        let scalar = scalars[index]
        if quoted {
            if scalar == "\"" {
                if index + 1 < scalars.count, scalars[index + 1] == "\"" {
                    field.unicodeScalars.append("\"")
                    index += 1
                } else {
                    quoted = false
                }
            } else {
                field.unicodeScalars.append(scalar)
            }
        } else if scalar == "\"" {
            quoted = true
        } else if scalar == "," {
            row.append(field)
            field = ""
        } else if scalar == "\r", index + 1 < scalars.count, scalars[index + 1] == "\n" {
            row.append(field)
            rows.append(row)
            row = []
            field = ""
            index += 1
        } else {
            field.unicodeScalars.append(scalar)
        }
        index += 1
    }
    if !field.isEmpty || !row.isEmpty { rows.append(row + [field]) }
    return rows
}

@Suite("The tracker's CSV export")
struct ExportTests {
    struct WebFile: Decodable {
        var lang: String
        var digits: Bool
        var timeZone: String
        var hijriOffset: Int
        var csv: String

        var locale: DisplayLocale {
            DisplayLocale(language: lang == "ar" ? .ar : .en, arabicIndicDigits: digits)
        }
    }

    struct WebHistory: Decodable {
        var entries: [String: [String: String]]
        var loggedAt: [String: [String: Double]]
        var sunnah: [String: [String: Double]]
        var sessions: [String: [String: WebSession]]
    }

    struct Fixture: Decodable {
        var data: WebHistory
        var files: [WebFile]
        var fields: [[String]]
    }

    static func load() throws -> Fixture { try Fixtures.load(Fixture.self, "history-csv.json") }

    /// The bundled dataset's presets plus the free count: two columns each.
    static func tasbihColumnCount(_ dataset: AzkarDataset = .bundled) -> Int { (dataset.tasbihIDs.count + 1) * 2 }

    static let nativeColumnCount = Prayer.allCases.count * 7 + 3

    @Test("Fields are escaped and guarded against formulas exactly as the website's csvField")
    func fields() throws {
        let fixture = try Self.load()
        #expect(fixture.fields.count >= 10)
        for pair in fixture.fields {
            #expect(HistoryCSV.field(pair[0]) == pair[1], "\(pair[0].debugDescription)")
        }
    }

    @Test("The website's columns come first and read exactly as the website writes them, in both languages")
    func webColumns() throws {
        let fixture = try Self.load()
        let history = TrackerHistory(
            prayers: WebData.prayers(entries: fixture.data.entries, loggedAt: fixture.data.loggedAt, sunnah: fixture.data.sunnah),
            sessions: WebData.sessions(fixture.data.sessions)
        )
        #expect(fixture.files.count == 4)
        for file in fixture.files {
            let native = HistoryCSV.csv(history, options: .init(locale: file.locale, timeZone: file.timeZone, hijriOffset: file.hijriOffset))
            #expect(native.hasPrefix("\u{FEFF}"))
            #expect(native.hasSuffix("\r\n"))
            let web = parseCSV(file.csv)
            let rows = parseCSV(native)
            let context = "\(file.lang), digits \(file.digits), \(file.timeZone)"
            #expect(rows.count == web.count, "\(context)")
            #expect(web.count > 100, "the fixture has a realistic history")
            let webWidth = web[0].count
            for (nativeRow, webRow) in zip(rows, web) {
                #expect(nativeRow.count == webWidth + Self.nativeColumnCount + Self.tasbihColumnCount(), "\(context)")
                #expect(Array(nativeRow.prefix(webWidth)) == webRow, "\(context) row \(webRow.first ?? "")")
                // Nothing beyond the website's records here, so every added cell but the header is empty.
                if nativeRow != rows[0] { #expect(nativeRow.dropFirst(webWidth).allSatisfy { $0.isEmpty }, "\(context)") }
            }
        }
    }

    @Test("The added columns carry the azkar after each prayer, the tasbih by preset and the fast")
    func addedColumns() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        let zone = "Asia/Riyadh"
        let at = { (text: String) in ISO8601DateFormatter().date(from: text)! }
        let history = TrackerHistory(
            sessions: [day("2026-10-27"): [
                .afterPrayer(.fajr): SessionRecord(startedAt: at("2026-10-27T02:10:00Z"), lastAt: at("2026-10-27T02:20:00Z"), completedAt: at("2026-10-27T02:20:00Z"), completed: true, done: 3, total: 9, recitations: 120),
                .afterPrayer(.isha): SessionRecord(startedAt: at("2026-10-27T16:00:00Z"), lastAt: at("2026-10-27T16:02:00Z"), completed: false, done: 2, total: 9, recitations: 40),
            ]],
            tasbih: [
                day("2026-10-28"): [
                    TasbihRecord(preset: "subhanallah", count: 99, lastAt: at("2026-10-28T19:30:00Z")),
                    TasbihRecord(preset: TasbihRecord.freeCount, count: 7, lastAt: at("2026-10-28T20:00:00Z")),
                    TasbihRecord(preset: "gone-from-the-dataset", count: 5, lastAt: nil),
                ],
            ],
            fasts: [
                day("2026-10-26"): FastRecord(kind: .voluntary, status: .fasted, loggedAt: at("2026-10-26T15:05:00Z")),
                day("2026-10-29"): FastRecord(kind: .qada, status: .broken, loggedAt: nil),
            ]
        )
        let english = parseCSV(HistoryCSV.csv(history, options: .init(locale: .english, timeZone: zone, hijriOffset: 0, dataset: dataset)))
        let header = english[0]
        func cell(_ day: String, _ column: String) throws -> String {
            let index = try #require(header.firstIndex(of: column), "no column \(column)")
            let row = try #require(english.first { $0.first == day }, "no row \(day)")
            return row[index]
        }
        #expect(english.map { $0[0] } == ["Date", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"])
        #expect(try cell("2026-10-27", "Azkar after Fajr: status") == "Completed")
        #expect(try cell("2026-10-27", "Azkar after Fajr: started at") == "2026-10-27 05:10")
        #expect(try cell("2026-10-27", "Azkar after Fajr: finished at") == "2026-10-27 05:20")
        // A completed session counts as read in full.
        #expect(try cell("2026-10-27", "Azkar after Fajr: azkar done") == "9")
        #expect(try cell("2026-10-27", "Azkar after Fajr: recitations") == "120")
        #expect(try cell("2026-10-27", "Azkar after Isha: status") == "In progress")
        #expect(try cell("2026-10-27", "Azkar after Isha: azkar done") == "2")
        #expect(try cell("2026-10-27", "Azkar after Dhuhr: status") == "")
        // Presets in the dataset's order (named by transliteration), then any other, then the free count.
        let tasbihHeaders = header.filter { $0.hasPrefix("Tasbih: ") }
        #expect(tasbihHeaders == [
            "Tasbih: Subḥānallāh: count", "Tasbih: Subḥānallāh: last count at",
            "Tasbih: alhamdulillah: count", "Tasbih: alhamdulillah: last count at",
            "Tasbih: gone-from-the-dataset: count", "Tasbih: gone-from-the-dataset: last count at",
            "Tasbih: Free count: count", "Tasbih: Free count: last count at",
        ])
        #expect(try cell("2026-10-28", "Tasbih: Subḥānallāh: count") == "99")
        #expect(try cell("2026-10-28", "Tasbih: Subḥānallāh: last count at") == "2026-10-28 22:30")
        #expect(try cell("2026-10-28", "Tasbih: alhamdulillah: count") == "")
        #expect(try cell("2026-10-28", "Tasbih: gone-from-the-dataset: count") == "5")
        #expect(try cell("2026-10-28", "Tasbih: Free count: count") == "7")
        #expect(try cell("2026-10-27", "Tasbih: Free count: count") == "")
        #expect(try cell("2026-10-26", "Fast") == "Voluntary fast")
        #expect(try cell("2026-10-26", "Fast: status") == "Fasted")
        #expect(try cell("2026-10-26", "Fast: logged at") == "2026-10-26 18:05")
        #expect(try cell("2026-10-29", "Fast") == "Make-up fast")
        #expect(try cell("2026-10-29", "Fast: status") == "Broke the fast")
        #expect(try cell("2026-10-29", "Fast: logged at") == "")
        #expect(header.suffix(3) == ["Fast", "Fast: status", "Fast: logged at"])

        let arabic = parseCSV(HistoryCSV.csv(history, options: .init(locale: .arabic, timeZone: zone, hijriOffset: 0, dataset: dataset)))
        #expect(arabic[0].count == header.count)
        #expect(arabic[0].contains("أذكار بعد صلاة الفجر: الحالة"))
        #expect(arabic[0].contains("التسبيح: subhanallah-text one two three four five six seven: العدد"))
        #expect(arabic[0].contains("التسبيح: عدّ حرّ: العدد"))
        #expect(arabic[0].suffix(3) == ["الصيام", "الصيام: الحالة", "الصيام: وقت التسجيل"])
        let fastRow = try #require(arabic.first { $0.first == "2026-10-26" })
        #expect(fastRow.suffix(3) == ["صيام تطوع", "صيام تام", "2026-10-26 18:05"])
        // The Hijri date in Arabic-Indic digits, as the website writes it.
        #expect(fastRow[1] == HijriFormat.full(day("2026-10-26"), offset: 0, locale: .arabic))
        #expect(fastRow[1].unicodeScalars.contains { (0x0660...0x0669).contains($0.value) })
    }

    @Test("The Quran's columns come last, only once anything of the Quran is recorded")
    func quranColumns() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        let zone = "Asia/Riyadh"
        let at = { (text: String) in ISO8601DateFormatter().date(from: text)! }
        func read(_ key: String, _ from: Int, _ to: Int, _ time: String) -> QuranEntry {
            QuranEntry(day: day(key), at: at(time), kind: .read, fromPage: from, toPage: to)
        }
        let fast = [day("2026-10-20"): FastRecord(kind: .qada, status: .fasted, loggedAt: nil)]
        let quran = [
            read("2026-10-21", 0, 500, "2026-10-21T17:00:00Z"),
            read("2026-10-21", 500, 590, "2026-10-21T18:30:00Z"),
            // Past midnight in Riyadh, and counted for the day before as it was passed.
            read("2026-10-22", 590, 604, "2026-10-22T21:15:00Z"),
            QuranEntry(day: day("2026-10-22"), at: at("2026-10-22T21:20:00Z"), kind: .khatmah, fromPage: 0, toPage: 0),
            read("2026-10-23", 0, 7, "2026-10-23T06:00:00Z"),
            read("2026-10-24", 7, 2, "2026-10-24T06:00:00Z"),
            QuranEntry(day: day("2026-10-25"), at: at("2026-10-25T06:00:00Z"), kind: .khatmah, fromPage: 2, toPage: 0),
        ]
        let options = HistoryCSV.Options(locale: .english, timeZone: zone, hijriOffset: 0, dataset: dataset)
        let without = HistoryCSV.csv(TrackerHistory(fasts: fast), options: options)
        let rows = parseCSV(HistoryCSV.csv(TrackerHistory(fasts: fast, quran: quran), options: options))
        let plain = parseCSV(without)

        #expect(!without.contains("Quran"))
        #expect(rows[0] == plain[0] + ["Quran: pages read", "Quran: khatmahs", "Quran: last read at"])
        #expect(rows.map { $0[0] } == ["Date", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"])
        // The columns before the Quran's are what they were.
        #expect(rows[1].dropLast(3) == plain[1][...])
        #expect(rows[1].suffix(3) == ["", "", ""], "nothing of the Quran that day")
        #expect(rows[2].suffix(3) == ["590", "0", "2026-10-21 21:30"])
        #expect(rows[3].suffix(3) == ["14", "2", "2026-10-23 00:15"], "a finished khatmah and one by hand")
        #expect(rows[4].suffix(3) == ["7", "0", "2026-10-23 09:00"])
        #expect(rows[5].suffix(3) == ["0", "0", "2026-10-24 09:00"], "a correction adds no pages")
        #expect(rows[6].suffix(3) == ["0", "1", ""], "a khatmah by hand is no reading")

        let arabic = parseCSV(HistoryCSV.csv(TrackerHistory(quran: quran), options: .init(locale: .arabic, timeZone: zone, hijriOffset: 0, dataset: dataset)))
        #expect(arabic[0].suffix(3) == ["القرآن: الصفحات المقروءة", "القرآن: الختمات", "القرآن: وقت آخر قراءة"])
    }

    @Test("The seasons' columns come last, only once anything of them is recorded")
    func seasonColumns() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        let at = ISO8601DateFormatter().date(from: "2027-02-08T18:00:00Z")!
        let fast = [day("2027-02-08"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil)]
        let quran = [QuranEntry(day: day("2027-02-08"), at: at, kind: .read, fromPage: 0, toPage: 5)]
        func record(_ deed: SeasonDeed, _ key: String, place: WorshipPlace? = nil, rakahs: Int? = nil) -> [SeasonDeed: SeasonRecord] {
            [deed: SeasonRecord(deed: deed, day: day(key), at: at, place: place, rakahs: rakahs)]
        }
        let seasons: [DayKey: [SeasonDeed: SeasonRecord]] = [
            day("2027-02-07"): record(.tarawih, "2027-02-07", place: .masjid, rakahs: 20),
            day("2027-02-08"): record(.tarawih, "2027-02-08", place: .home),
            // Neither place nor rakahs: it was prayed all the same, and the file says so.
            day("2027-02-09"): record(.tarawih, "2027-02-09"),
            day("2027-03-09"): record(.eidPrayer, "2027-03-09"),
            day("2027-05-16"): record(.eidPrayer, "2027-05-16", place: .masjid),
            // A day with nothing left on it is no record.
            day("2027-06-01"): [:],
        ]
        let options = HistoryCSV.Options(locale: .english, timeZone: "UTC", hijriOffset: 0, dataset: dataset)
        let without = HistoryCSV.csv(TrackerHistory(fasts: fast, quran: quran), options: options)
        #expect(without == HistoryCSV.csv(TrackerHistory(fasts: fast, quran: quran, seasons: [day("2027-06-01"): [:]]), options: options))
        #expect(!without.contains("Tarawih") && !without.contains("Eid prayer"))
        let plain = parseCSV(without)

        let rows = parseCSV(HistoryCSV.csv(TrackerHistory(fasts: fast, quran: quran, seasons: seasons), options: options))
        #expect(rows[0] == plain[0] + ["Tarawih: place", "Tarawih: rakahs", "Eid prayer"])
        #expect(rows[0].dropLast(3).suffix(3) == ["Quran: pages read", "Quran: khatmahs", "Quran: last read at"], "after the Quran's")
        #expect(rows.map { $0[0] } == ["Date", "2027-02-07", "2027-02-08", "2027-02-09", "2027-03-09", "2027-05-16"])
        #expect(rows[1].suffix(3) == ["Masjid", "20", ""])
        #expect(rows[2].suffix(3) == ["Home", "", ""])
        #expect(rows[2].dropLast(3) == plain[1][...], "the columns before the seasons' are what they were")
        #expect(rows[3].suffix(3) == ["Not stated", "", ""])
        #expect(rows[4].suffix(3) == ["", "", "Prayed"])
        #expect(rows[5].suffix(3) == ["", "", "Masjid"])

        // Without the Quran the seasons follow the fast at once.
        let noQuran = parseCSV(HistoryCSV.csv(TrackerHistory(fasts: fast, seasons: seasons), options: options))
        #expect(noQuran[0].suffix(4) == ["Fast: logged at", "Tarawih: place", "Tarawih: rakahs", "Eid prayer"])

        let arabic = parseCSV(HistoryCSV.csv(TrackerHistory(seasons: seasons), options: .init(locale: .arabic, timeZone: "UTC", hijriOffset: 0, dataset: dataset)))
        #expect(arabic[0].suffix(3) == ["التراويح: المكان", "التراويح: الركعات", "صلاة العيد"])
        #expect(arabic[1].suffix(3) == ["المسجد", "20", ""])
        #expect(arabic[2].suffix(3) == ["البيت", "", ""])
        #expect(arabic[3].suffix(3) == ["غير محدد", "", ""])
        #expect(arabic[4].suffix(3) == ["", "", "صُلّيت"])
    }

    @Test("An empty history is the header row alone, and an unknown zone falls back to the device's")
    func emptyAndUnknownZone() {
        let empty = HistoryCSV.csv(TrackerHistory(), options: .init(locale: .english, timeZone: "Not/AZone", hijriOffset: 0))
        let rows = parseCSV(empty)
        #expect(rows.count == 1)
        #expect(rows[0].prefix(3) == ["Date", "Hijri date", "Time zone"])
        let one = HistoryCSV.csv(
            TrackerHistory(fasts: [day("2026-10-26"): FastRecord(kind: .ramadan, status: .excused, loggedAt: nil)]),
            options: .init(locale: .english, timeZone: "Not/AZone", hijriOffset: 0)
        )
        #expect(parseCSV(one)[1][2] == TimeZone.current.identifier)
    }
}
