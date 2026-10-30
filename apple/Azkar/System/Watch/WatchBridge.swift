import AzkarKit
import Foundation
import WatchConnectivity

/// The iPhone's side of the Watch app: shows it the prayers and the day's tasbih, and carries out
/// what is done there. The records stay here; the Watch only ever holds a copy of the board, and
/// what it asks for goes through the same stores as a widget or Siri.
@MainActor
final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()

    private static let appliedKey = "watch.appliedActions"
    /// How many counts are remembered, to know one delivered twice.
    private static let appliedLimit = 100
    private var lastSent: Data?

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Sends the board if the Watch app is there and anything on it changed.
    func push(settings: SettingsSnapshot, board: SystemPrayerBoard?, force: Bool = false) async {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated,
              WCSession.default.isPaired, WCSession.default.isWatchAppInstalled, let board else { return }
        let today = (try? await SharedRecords.store().day(board.today)) ?? DayRecords(day: board.today)
        let language = SystemLanguage(settings.app)
        var shown = WatchBoard(
            generatedAt: .distantPast, languageCode: language.code, arabicDigits: language.arabicDigits, uses24Hour: language.uses24Hour,
            timeZone: board.place.timeZone.identifier, placeName: board.placeName,
            days: board.timeline.days.filter { $0.day >= board.today }.map { day in
                WatchBoard.Day(day: day.day, rows: Prayer.allCases.map { prayer in
                    WatchBoard.Row(prayer: prayer, at: day[prayer: prayer], status: board.status(of: prayer, on: day.day))
                })
            },
            tasbihDay: board.today, tasbihCount: today.tasbih.values.reduce(0) { $0 + $1.count },
            appliedActions: applied.suffix(20)
        )
        // The time it was made on is not a change worth sending.
        let unchanged = WatchLink.encode(shown)
        guard force || unchanged != lastSent else { return }
        lastSent = unchanged
        shown.generatedAt = .now
        guard let data = WatchLink.encode(shown) else { return }
        do {
            try WCSession.default.updateApplicationContext([WatchLink.boardKey: data])
        } catch {
            print("Watch: sending the board failed: \(error)")
        }
    }

    /// Pushes the board as it stands now.
    private func pushNow(force: Bool = false) async {
        let (settings, board) = await SystemServices.shared.currentBoard()
        await push(settings: settings, board: board, force: force)
    }

    // MARK: What the Watch asks

    private var applied: [UUID] {
        get { (UserDefaults.standard.stringArray(forKey: Self.appliedKey) ?? []).compactMap(UUID.init(uuidString:)) }
        set { UserDefaults.standard.set(newValue.suffix(Self.appliedLimit).map(\.uuidString), forKey: Self.appliedKey) }
    }

    private func handle(_ action: WatchAction) async {
        switch action {
        case .refresh:
            await pushNow(force: true)
        case let .tick(prayer, day):
            do {
                try await PrayerLogging.tick(prayer, on: day)
            } catch {
                print("Watch: logging \(prayer) on \(day) failed: \(error)")
            }
            await pushNow()
        case let .tasbih(id, count, day):
            if !applied.contains(id) {
                do {
                    try await SharedRecords.store().countTasbih(nil, times: count, on: day)
                    applied.append(id)
                } catch {
                    print("Watch: counting \(count) on \(day) failed: \(error)")
                }
            }
            await pushNow(force: true)
        }
    }

    // MARK: WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        Task { @MainActor in await pushNow() }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    /// The user moved to another Watch: start again with it.
    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        Task { @MainActor in await pushNow() }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(message[WatchLink.actionKey] as? Data)
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(userInfo[WatchLink.actionKey] as? Data)
    }

    private nonisolated func receive(_ data: Data?) {
        guard let action = WatchLink.decode(WatchAction.self, from: data) else { return }
        Task { @MainActor in await handle(action) }
    }
}
