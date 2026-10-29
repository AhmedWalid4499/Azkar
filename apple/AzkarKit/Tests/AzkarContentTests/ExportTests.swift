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
