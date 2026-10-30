import AzkarCore
import Foundation
import Observation
import WatchConnectivity

/// The Watch's copy of the board, and what was done here that the iPhone has not shown back yet.
/// Everything goes to the iPhone at once when it is in reach and is queued by the system when it
/// is not, so nothing done here is lost.
@MainActor
@Observable
final class WatchStore: NSObject, WCSessionDelegate {
    static let shared = WatchStore()

    /// The latest board, kept for when the iPhone is out of reach.
    private(set) var board: WatchBoard?
    /// Ticks the board does not show yet.
    private(set) var pendingTicks: Set<PendingTick> = []
    /// Counts not sent yet, and the day they were made on.
    private(set) var unsentTasbih = 0
    private var unsentDay: DayKey?
    /// Counts sent that the iPhone has not confirmed, by action.
    private var sentTasbih: [UUID: Int] = [:]
    @ObservationIgnored private var flushTask: Task<Void, Never>?

    struct PendingTick: Hashable, Codable, Sendable {
        var prayer: Prayer
        var day: DayKey
    }

    private enum Key {
        static let board = "board"
        static let ticks = "pendingTicks"
        static let unsent = "unsentTasbih"
        static let unsentDay = "unsentTasbihDay"
        static let sent = "sentTasbih"
    }

    override private init() {
        super.init()
        let defaults = UserDefaults.standard
        board = WatchLink.decode(WatchBoard.self, from: defaults.data(forKey: Key.board))
        pendingTicks = WatchLink.decode(Set<PendingTick>.self, from: defaults.data(forKey: Key.ticks)) ?? []
        unsentTasbih = defaults.integer(forKey: Key.unsent)
        unsentDay = WatchLink.decode(DayKey.self, from: defaults.data(forKey: Key.unsentDay))
        sentTasbih = WatchLink.decode([UUID: Int].self, from: defaults.data(forKey: Key.sent)) ?? [:]
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: Prayers

    func tick(_ prayer: Prayer, on day: DayKey) {
        pendingTicks.insert(PendingTick(prayer: prayer, day: day))
        saveTicks()
        send(.tick(prayer, day), queued: true)
    }

    func isTicked(_ prayer: Prayer, on day: DayKey) -> Bool {
        pendingTicks.contains(PendingTick(prayer: prayer, day: day))
    }

    // MARK: Tasbih

    /// Today's count: the iPhone's, with what it has not shown back yet.
    func tasbihToday(at now: Date) -> Int {
        guard let board else { return unsentTasbih }
        let onBoard = board.tasbihDay == board.today(at: now) ? board.tasbihCount : 0
        return onBoard + unsentTasbih + sentTasbih.values.reduce(0, +)
    }

    /// One more; they are sent together once the counting pauses.
    func countTasbih(at now: Date) {
        let today = board?.today(at: now) ?? DayKey(now, in: .current)
        if let unsentDay, unsentDay != today { flushTasbih() }
        unsentDay = today
        unsentTasbih += 1
        saveTasbih()
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            self?.flushTasbih()
        }
    }

    /// Sends the counts not sent yet.
    func flushTasbih() {
        flushTask?.cancel()
        guard unsentTasbih > 0, let day = unsentDay else { return }
        let id = UUID()
        sentTasbih[id] = unsentTasbih
        send(.tasbih(id: id, count: unsentTasbih, day: day), queued: true)
        unsentTasbih = 0
        unsentDay = nil
        saveTasbih()
    }

    // MARK: Talking to the iPhone

    func refresh() {
        send(.refresh, queued: false)
        flushTasbih()
    }

    /// Delivers `action` now if the iPhone is in reach. Otherwise, or if that fails, a `queued`
    /// action waits with the system until the two meet again.
    private func send(_ action: WatchAction, queued: Bool) {
        guard let data = WatchLink.encode(action) else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        let message = [WatchLink.actionKey: data]
        guard session.isReachable else {
            if queued { session.transferUserInfo(message) }
            return
        }
        session.sendMessage(message, replyHandler: nil) { [queued] _ in
            guard queued else { return }
            WCSession.default.transferUserInfo([WatchLink.actionKey: data])
        }
    }

    private func apply(_ data: Data?) {
        guard let data, let received = WatchLink.decode(WatchBoard.self, from: data) else { return }
        if let board, board.generatedAt > received.generatedAt { return }
        board = received
        UserDefaults.standard.set(data, forKey: Key.board)
        for id in received.appliedActions { sentTasbih[id] = nil }
        pendingTicks = pendingTicks.filter { tick in
            guard let day = received.days.first(where: { $0.day == tick.day }) else { return false }
            return day.rows.first { $0.prayer == tick.prayer }?.status == nil
        }
        saveTicks()
        saveTasbih()
    }

    private func saveTicks() {
        UserDefaults.standard.set(WatchLink.encode(pendingTicks), forKey: Key.ticks)
    }

    private func saveTasbih() {
        let defaults = UserDefaults.standard
        defaults.set(unsentTasbih, forKey: Key.unsent)
        defaults.set(unsentDay.flatMap(WatchLink.encode), forKey: Key.unsentDay)
        defaults.set(WatchLink.encode(sentTasbih), forKey: Key.sent)
    }

    // MARK: WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let data = session.receivedApplicationContext[WatchLink.boardKey] as? Data
        Task { @MainActor in
            self.apply(data)
            self.refresh()
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        let data = applicationContext[WatchLink.boardKey] as? Data
        Task { @MainActor in self.apply(data) }
    }
}
