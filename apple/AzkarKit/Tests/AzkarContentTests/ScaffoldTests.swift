import Adhan
import Foundation
import Testing
@testable import AzkarContent

@Suite("Scaffold")
struct ScaffoldTests {
    @Test("The bundled dataset is byte-identical to the website's")
    func datasetMatchesWebSource() throws {
        let repo = URL(fileURLWithPath: #filePath).resolvingSymlinksInPath()
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let web = try Data(contentsOf: repo.appending(path: "src/features/azkar/data/azkar.json"))
        let bundled = try Data(contentsOf: AzkarResources.datasetURL)
        #expect(bundled == web, "Copy src/features/azkar/data/azkar.json to apple/AzkarKit/Sources/AzkarContent/Resources/")
    }

    @Test("Adhan is wired in: Cairo's Dhuhr on 2026-10-12 is around 12:40 local time")
    func adhanComputes() throws {
        let coordinates = Coordinates(latitude: 30.0444, longitude: 31.2357)
        var components = DateComponents()
        components.year = 2026
        components.month = 10
        components.day = 12
        let params = CalculationMethod.egyptian.params
        let times = try #require(PrayerTimes(coordinates: coordinates, date: components, calculationParameters: params))
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "Africa/Cairo"))
        let dhuhr = calendar.dateComponents([.hour, .minute], from: times.dhuhr)
        #expect(dhuhr.hour == 12)
        #expect((38...44).contains(dhuhr.minute ?? 0))
    }
}
