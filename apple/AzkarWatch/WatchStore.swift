import AzkarCore
import Foundation
import Observation
import WatchConnectivity

/// The Watch's copy of the board, and what was done here that the iPhone has not confirmed.
///
/// Everything done here stays in `outbox`, across launches, until a board lists it as carried out.
/// It is sent at once when the iPhone is in reach, handed to the system's queue when it is not, and
/// sent again whenever the two meet, so nothing is lost; the iPhone carries out each action once.
@MainActor
@Observable
final class WatchStore: NSObject, WCSessionDelegate {
    static let shared = WatchStore()

    /// The latest board, kept for when the iPhone is out of reach.
    private(set) var board: WatchBoard?
    /// What the iPhone has not confirmed, oldest first.
    private(set) var outbox: [WatchAction] = []
    /// Counts not sent yet, and the day they were made on.
    private(set) var unsentTasbih = 0
    private var unsentDay: DayKey?
    @ObservationIgnored private var flushTask: Task<Void, Never>?
    /// Actions already with the system's queue, which needs each only once.
    @ObservationIgnored private var queued: Set<UUID> = []

    private enum Key {
        static let board = "board"
        static let outbox = "outbox"
        static let unsent = "unsentTasbih"
        static let unsentDay = "unsentTasbihDay"
    }

    override private init() {
        super.init()
        let defaults = UserDefaults.standard
        board = WatchLink.decode(WatchBoard.self, from: defaults.data(forKey: Key.board))
        outbox = WatchLink.decode([WatchAction].self, from: defaults.data(forKey: Key.outbox)) ?? []
        unsentTasbih = defaults.integer(forKey: Key.unsent)
        unsentDay = WatchLink.decode(DayKey.self, from: defaults.data(forKey: Key.unsentDay))
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: Prayers

    func tick(_ prayer: Prayer, on day: DayKey) {
        add(.tick(id: UUID(), prayer: prayer, day: day))
    }

    /// Ticked here and not confirmed yet.
    func isTicked(_ prayer: Prayer, on day: DayKey) -> Bool {
        outbox.contains {
            if case .tick(_, prayer, day) = $0 { true } else { false }
        }
    }

    // MARK: Tasbih

    /// Today's count: the iPhone's, with what it has not confirmed.
    func tasbihToday(at now: Date) -> Int {
        guard let board else { return unsentTasbih }
        let today = board.today(at: now)
        let waiting = outbox.reduce(0) { total, action in
            if case .tasbih(_, let count, today) = action { total + count } else { total }
        }
        return (board.tasbihDay == today ? board.tasbihCount : 0) + waiting + (unsentDay == today ? unsentTasbih : 0)
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
        let count = unsentTasbih
        unsentTasbih = 0
        unsentDay = nil
        saveTasbih()
        add(.tasbih(id: UUID(), count: count, day: day))
    }

    // MARK: Talking to the iPhone

    /// Sends everything waiting, and asks for the board.
    func refresh() {
        flushTasbih()
        sendOutbox()
        deliver(.refresh)
    }

    private func add(_ action: WatchAction) {
        outbox.append(action)
        saveOutbox()
        deliver(action)
    }

    private func sendOutbox() {
        for action in outbox { deliver(action) }
    }

    /// Nothing happens before the connection has started; activating sends the outbox.
    private func deliver(_ action: WatchAction) {
        let session = WCSession.default
        guard session.activationState == .activated, let data = WatchLink.encode(action) else { return }
        guard session.isReachable else {
            enqueue(action, data)
            return
        }
        // Called on a queue of the system's, so it must not belong to the main actor.
        session.sendMessage([WatchLink.actionKey: data], replyHandler: nil) { @Sendable [weak self] _ in
            Task { @MainActor in self?.enqueue(action, data) }
        }
    }

    /// Hands an action to the system to deliver when it can.
    private func enqueue(_ action: WatchAction, _ data: Data) {
        guard let id = action.id, queued.insert(id).inserted else { return }
        WCSession.default.transferUserInfo([WatchLink.actionKey: data])
    }

    private func apply(_ data: Data?) {
        guard let data, let received = WatchLink.decode(WatchBoard.self, from: data) else { return }
        if let board, board.generatedAt > received.generatedAt { return }
        board = received
        UserDefaults.standard.set(data, forKey: Key.board)
        outbox.removeAll { action in action.id.map(received.appliedActions.contains) ?? true }
        saveOutbox()
    }

    private func saveOutbox() {
        UserDefaults.standard.set(WatchLink.encode(outbox), forKey: Key.outbox)
    }

    private func saveTasbih() {
        let defaults = UserDefaults.standard
        defaults.set(unsentTasbih, forKey: Key.unsent)
        defaults.set(unsentDay.flatMap(WatchLink.encode), forKey: Key.unsentDay)
    }

    // MARK: WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let data = session.receivedApplicationContext[WatchLink.boardKey] as? Data
        Task { @MainActor in
            self.apply(data)
            self.refresh()
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        guard session.isReachable else { return }
        Task { @MainActor in self.refresh() }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        let data = applicationContext[WatchLink.boardKey] as? Data
        Task { @MainActor in self.apply(data) }
    }
}
