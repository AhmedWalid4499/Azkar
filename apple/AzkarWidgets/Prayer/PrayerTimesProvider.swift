import AzkarKit
import Foundation
import WidgetKit

/// Builds the widgets' timeline from the App Group's stores: an entry now, at each prayer time
/// (the next prayer moves on) and at each midnight at the place, for the day ahead. The app asks for
/// a new timeline whenever a record or setting is saved.
nonisolated struct PrayerTimesProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerTimesEntry { .sample() }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (PrayerTimesEntry) -> Void) {
        if context.isPreview {
            completion(.sample())
            return
        }
        Task { completion(await Self.entries(from: .now).first ?? .sample()) }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<PrayerTimesEntry>) -> Void) {
        Task {
            let entries = await Self.entries(from: .now)
            // Without a place, look again in a few hours (the app also reloads when one is saved).
            let policy: TimelineReloadPolicy = entries.count > 1 ? .atEnd : .after(.now.addingTimeInterval(6 * 3600))
            completion(Timeline(entries: entries, policy: policy))
        }
    }

    static func entries(from now: Date) async -> [PrayerTimesEntry] {
        let settings = SharedRecords.settings.load()
        let language = SystemLanguage(settings.app)
        let store = try? SharedRecords.store()
        let prayers = (try? await store?.prayersAround(now, in: settings.timeZone, back: 2, ahead: 2)) ?? [:]
        guard let first = SystemPrayerBoard(settings: settings, prayers: prayers, now: now) else {
            return [PrayerTimesEntry(date: now, language: language, name: settings.app.name, content: .noLocation, azkar: [])]
        }
        let dates = [now] + first.changes(until: now.addingTimeInterval(36 * 3600))
        var entries: [PrayerTimesEntry] = []
        for date in dates {
            guard let board = SystemPrayerBoard(settings: settings, prayers: prayers, now: date) else { continue }
            let azkar = await progress(at: date, board: board, store: store)
            entries.append(PrayerTimesEntry(date: date, language: language, name: settings.app.name, content: .ready(board), azkar: azkar))
        }
        return entries
    }

    /// The morning, evening and bedtime readings that count now (before dawn, last night's).
    static func progress(at date: Date, board: SystemPrayerBoard, store: RecordStore?) async -> [PrayerTimesEntry.SessionProgress] {
        let dataset = AzkarDataset.bundled
        let todayTimes = board.timeline.days.first { $0.day == board.today }
        let phase = DayPhase(at: date, in: board.place.timeZone, prayerDay: todayTimes)
        var result: [PrayerTimesEntry.SessionProgress] = []
        for session in dataset.availableCollections {
            let day = phase.sessionDay(for: session, today: board.today)
            let record = try? await store?.day(day).sessions[session]
            let total = dataset.azkar(for: session).count
            result.append(.init(session: session, done: min(record?.done ?? 0, total), total: total, completed: record?.completed ?? false))
        }
        return result
    }
}
