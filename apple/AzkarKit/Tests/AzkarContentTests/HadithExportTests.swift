import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite("The hadith of the day in the Tracker and the export")
struct HadithExportTests {
    @Test("The hadith read is its own last column, only once one was read, and makes its day a recorded day")
    func column() throws {
        let fast = [day("2026-11-10"): FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil)]
        let without = parseCSV(HistoryCSV.csv(TrackerHistory(fasts: fast), options: .init(locale: .english, timeZone: "UTC", hijriOffset: 0)))
        #expect(!without[0].contains("Hadith of the day: Riyad as-Salihin no."))

        let history = TrackerHistory(fasts: fast, hadithRead: [day("2026-11-16"): 1268])
        let english = parseCSV(HistoryCSV.csv(history, options: .init(locale: .english, timeZone: "UTC", hijriOffset: 0)))
        #expect(english[0].last == "Hadith of the day: Riyad as-Salihin no.")
        #expect(english.map { $0[0] } == ["Date", "2026-11-10", "2026-11-16"])
        #expect(english[1].last == "")
        #expect(english[2].last == "1268")
        let arabic = parseCSV(HistoryCSV.csv(history, options: .init(locale: .arabic, timeZone: "UTC", hijriOffset: 0)))
        #expect(arabic[0].count == english[0].count)

        #expect(TrackerStats.recordedDays(TrackerHistory(hadithRead: [day("2026-11-16"): 3])) == [day("2026-11-16")])
        #expect(TrackerStats.hasAnyRecord(TrackerHistory(hadithRead: [day("2026-11-16"): 3]), today: day("2026-11-16")))
    }
}
