#if DEBUG
import AzkarKit
import Foundation

/// DEBUG-only launch arguments for looking at the Azkar tab in every state:
///
/// - `-ReadingDemoDataset <path>`: read the azkar from that `azkar.json` (e.g. the web branch's
///   fixture with the bedtime, after-prayer and tasbih lists) into a throwaway in-memory record
///   store, leaving the app's records alone.
/// - `-ReadingMarksSample YES` (with the demo dataset): adds a first morning item that wraps
///   Ayat al-Kursi in the signs ۞ (U+06DE) and ۩ (U+06E9), to check how Amiri draws them.
/// - `-ReadingSeed YES`: counts some sample progress through `RecordsModel` (once per day).
/// - `-ReadingOpen morning|evening|sleep|afterPrayer:fajr|tasbih`: opens that screen.
/// - `-ReadingPage <n>`: the reader starts at dhikr n (0-based) instead of resuming.
/// - `-ReadingArabicScale <1…5>`, `-ReadingAutoAdvance YES|NO`: change those reader settings.
/// - `-ReadingPeek YES`: the reader's neighbouring pages show at its edges, to check their order.
/// - `-ReadingSelectTab <n>` (ReadingDebugTab.m): selects tab n shortly after launch.
/// - `-ReadingScript "tap*3,wait2,undo,next"`: presses the reader's or the tasbih counter's own
///   controls in turn, 0.4 s apart (`waitN` waits N seconds), once per launch, so every state can
///   be reached without touching the screen. Actions: tap, undo, markall, next, prev, overview,
///   close, startover, reset (tasbih).
enum ReadingDebug {
    @MainActor private static var scriptRan = false

    /// Runs the launch script against `actions`, by name.
    @MainActor
    static func runScript(_ actions: [String: () -> Void]) async {
        guard !scriptRan, let script = defaults.string(forKey: "ReadingScript") else { return }
        scriptRan = true
        try? await Task.sleep(for: .seconds(1))
        for step in script.split(separator: ",").map({ $0.trimmingCharacters(in: .whitespaces) }) {
            if step.hasPrefix("wait"), let seconds = Double(step.dropFirst(4)) {
                try? await Task.sleep(for: .seconds(seconds))
                continue
            }
            let parts = step.split(separator: "*")
            let name = String(parts[0])
            let times = parts.count > 1 ? Int(parts[1]) ?? 1 : 1
            NSLog("ReadingDebug: %@ ×%d%@", name, times, actions[name] == nil ? " (unknown)" : "")
            for _ in 0..<times {
                actions[name]?()
                try? await Task.sleep(for: .milliseconds(times > 1 ? 120 : 400))
            }
        }
        NSLog("ReadingDebug: script done")
    }

    private static var defaults: UserDefaults { .standard }

    static var startPage: Int? {
        defaults.object(forKey: "ReadingPage") == nil ? nil : defaults.integer(forKey: "ReadingPage")
    }

    static func context(_ app: AppEnvironment) -> ReadingContext? {
        guard let path = defaults.string(forKey: "ReadingDemoDataset") else { return nil }
        do {
            var dataset = try AzkarDataset(json: Data(contentsOf: URL(filePath: path)))
            if defaults.bool(forKey: "ReadingMarksSample") { dataset = try withMarksSample(dataset) }
            let settingsStore = app.settingsStore
            let store = try RecordStore.open(.inMemory, catalog: DatasetCatalog(dataset), timeZone: { settingsStore.timeZone() })
            NSLog("ReadingDebug: demo dataset loaded, %d azkar", dataset.items.count)
            return ReadingContext(dataset: dataset, records: RecordsModel(store: store), settings: app.settings)
        } catch {
            NSLog("ReadingDebug: the demo dataset did not load: %@", String(describing: error))
            return nil
        }
    }

    private static func withMarksSample(_ dataset: AzkarDataset) throws -> AzkarDataset {
        guard var sample = dataset.dhikr(id: "ayat-al-kursi") else { return dataset }
        sample.id = "debug-quranic-marks"
        sample.arabic = "\u{06DE} " + sample.arabic + " \u{06E9}"
        var items = dataset.items
        items[sample.id] = sample
        var collections = dataset.collections
        collections[.morning] = [sample.id] + (collections[.morning] ?? [])
        return try AzkarDataset(version: dataset.version, sources: dataset.sources, items: items, collections: collections,
                                afterPrayerIDs: dataset.afterPrayerIDs, tasbihIDs: dataset.tasbihIDs)
    }

    static func launch(_ context: ReadingContext, router: ReadingRouter) {
        // `-ReadingArabicScale 1…5`, `-ReadingAutoAdvance NO`: saved through the settings model.
        if defaults.object(forKey: "ReadingArabicScale") != nil {
            context.updateReader { $0.arabicScale = defaults.integer(forKey: "ReadingArabicScale") }
        }
        if defaults.object(forKey: "ReadingAutoAdvance") != nil {
            context.updateReader { $0.autoAdvance = defaults.bool(forKey: "ReadingAutoAdvance") }
        }
        Task {
            if defaults.bool(forKey: "ReadingSeed") { await seed(context) }
            switch defaults.string(forKey: "ReadingOpen") {
            case "tasbih": router.openTasbih()
            case let key?: if let session = AzkarSession(key) { router.open(session) }
            case nil: break
            }
        }
    }

    /// Morning part-way, evening complete, Fajr's after-prayer azkar complete and Dhuhr's begun,
    /// and some tasbih counts.
    private static func seed(_ context: ReadingContext) async {
        await context.records.reload()
        let clock = ReadingClock(now: .now, settings: context.settings.settings)
        let records = context.records
        func count(_ session: AzkarSession, complete: Int, partial: Int) async {
            let day = clock.day(for: session)
            guard (context.day(day).counts[session] ?? [:]).isEmpty, context.day(day).sessions[session] == nil else { return }
            let items = context.dataset.azkar(for: session)
            for dhikr in items.prefix(complete) {
                _ = try? await records.count(.complete, dhikr: dhikr.id, in: session, on: day)
            }
            if items.count > complete {
                for _ in 0..<partial {
                    _ = try? await records.count(.increment, dhikr: items[complete].id, in: session, on: day)
                }
            }
        }
        await count(.morning, complete: 3, partial: 1)
        await count(.evening, complete: .max, partial: 0)
        await count(.afterPrayer(.fajr), complete: .max, partial: 0)
        await count(.afterPrayer(.dhuhr), complete: 2, partial: 0)

        let day = clock.tasbihDay
        guard context.day(day).tasbih.isEmpty else { return }
        defer { NSLog("ReadingDebug: seeded") }
        for _ in 0..<40 { _ = try? await records.countTasbih(nil, on: day) }
        if let preset = context.dataset.tasbihPresets.first {
            for _ in 0..<31 { _ = try? await records.countTasbih(preset.id, on: day) }
        }
    }
}
#endif
