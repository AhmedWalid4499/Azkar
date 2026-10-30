import Foundation
import Testing
@testable import AzkarCore

@Suite struct WatchLinkTests {
    private let today = DayKey(year: 2026, month: 10, day: 30)!
    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    private func board(rows: [WatchBoard.Row], days: Int = 1) -> WatchBoard {
        WatchBoard(generatedAt: start, languageCode: "ar", arabicDigits: true, uses24Hour: false, timeZone: "UTC", placeName: "Cairo",
                   days: (0..<days).map { WatchBoard.Day(day: DayKey(start.addingTimeInterval(Double($0) * 86_400), in: TimeZone(identifier: "UTC")!), rows: rows) },
                   tasbihDay: today, tasbihCount: 33, appliedActions: [UUID()])
    }

    @Test func aBoardSurvivesTheTrip() {
        let original = board(rows: [.init(prayer: .fajr, at: start, status: .jamaah), .init(prayer: .isha, at: nil, status: nil)])
        #expect(WatchLink.decode(WatchBoard.self, from: WatchLink.encode(original)) == original)
    }

    @Test(arguments: [
        WatchAction.refresh,
        .tick(.asr, DayKey(year: 2026, month: 10, day: 30)!),
        .tasbih(id: UUID(), count: 100, day: DayKey(year: 2026, month: 10, day: 30)!),
    ])
    func actionsSurviveTheTrip(action: WatchAction) {
        #expect(WatchLink.decode(WatchAction.self, from: WatchLink.encode(action)) == action)
    }

    @Test func garbageIsNotABoard() {
        #expect(WatchLink.decode(WatchBoard.self, from: Data("nope".utf8)) == nil)
        #expect(WatchLink.decode(WatchBoard.self, from: nil) == nil)
    }

    @Test func nextSkipsWhatHasPassedAndATimeThatDoesNotExist() {
        let rows: [WatchBoard.Row] = [
            .init(prayer: .fajr, at: start.addingTimeInterval(-60), status: nil),
            .init(prayer: .dhuhr, at: nil, status: nil),
            .init(prayer: .asr, at: start.addingTimeInterval(60), status: nil),
        ]
        #expect(board(rows: rows).next(after: start) == WatchBoard.Upcoming(prayer: .asr, at: start.addingTimeInterval(60)))
    }

    @Test func nothingNextOnceTheDaysRunOut() {
        #expect(board(rows: [.init(prayer: .fajr, at: start, status: nil)]).next(after: start.addingTimeInterval(1)) == nil)
    }

    @Test func todayFollowsTheBoardsDays() {
        let shown = board(rows: [], days: 2)
        #expect(shown.day(at: start.addingTimeInterval(86_400))?.day == shown.days[1].day)
        #expect(shown.day(at: start.addingTimeInterval(10 * 86_400)) == nil)
    }

    @Test func onlyAPrayerWhoseTimeHasComeAndIsNotLoggedCanBeTicked() {
        let shown = board(rows: [])
        #expect(shown.canTick(.init(prayer: .fajr, at: start, status: nil), at: start))
        #expect(!shown.canTick(.init(prayer: .asr, at: start.addingTimeInterval(1), status: nil), at: start))
        #expect(!shown.canTick(.init(prayer: .fajr, at: start, status: .late), at: start))
        #expect(!shown.canTick(.init(prayer: .fajr, at: nil, status: nil), at: start))
    }
}
