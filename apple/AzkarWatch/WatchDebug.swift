#if DEBUG
import AzkarCore
import Foundation

/// Debug builds, for trying the Watch app with no one at the wrist. The Watch simulator drops launch
/// arguments and the environment, so it reads `Documents/watch-debug`, then removes it: a prayer
/// to tick off once the board has arrived and a number of tasbih to count and send, as in `asr 7`.
/// `Documents/watch-debug-tasbih` opens on the tasbih page.
enum WatchDebug {
    static var startsOnTasbih: Bool {
        FileManager.default.fileExists(atPath: URL.documentsDirectory.appending(path: "watch-debug-tasbih").path)
    }

    static func run(_ store: WatchStore) async {
        let file = URL.documentsDirectory.appending(path: "watch-debug")
        guard let parts = (try? String(contentsOf: file, encoding: .utf8))?.split(whereSeparator: \.isWhitespace) else { return }
        try? FileManager.default.removeItem(at: file)
        let tick = parts.first.flatMap { Prayer(rawValue: String($0)) }
        let count = parts.last.flatMap { Int($0) } ?? 0
        guard tick != nil || count > 0 else { return }
        for _ in 0..<30 where store.board == nil {
            try? await Task.sleep(for: .seconds(1))
        }
        if let tick, let board = store.board { store.tick(tick, on: board.today(at: .now)) }
        for _ in 0..<count { store.countTasbih(at: .now) }
        store.flushTasbih()
    }
}
#endif
