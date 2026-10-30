import AzkarKit
import SwiftUI
import WidgetKit

/// The Quran widget: the page reading goes on from and how far this khatmah is; in Ramadan, with
/// the day, the night's tarawih and the pages a day the khatmah goal asks for. Opens the mushaf.
struct QuranWidget: Widget {
    static let kind = "Quran"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: QuranWidgetProvider()) { entry in
            QuranWidgetView(entry: entry)
                .systemLanguage(entry.language)
                .tint(.azkarAccent)
                .containerBackground(for: .widget) { WidgetBackdrop() }
                .widgetURL(SystemRoute.quran.url)
        }
        .configurationDisplayName(Text("Quran", tableName: SystemText.table))
        .description(Text("Your place in the Quran, with tarawih and your goal in Ramadan.", tableName: SystemText.table))
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// Builds the timeline from the App Group's stores: an entry now, at each prayer time (Maghrib
/// brings the next night, Fajr ends it) and at each midnight at the place. The app asks for a new
/// timeline whenever a record or setting is saved.
nonisolated struct QuranWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuranWidgetEntry { .sample() }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (QuranWidgetEntry) -> Void) {
        if context.isPreview {
            completion(.sample())
            return
        }
        Task { completion(await Self.entries(from: .now).first ?? .sample()) }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<QuranWidgetEntry>) -> Void) {
        Task {
            let entries = await Self.entries(from: .now)
            // Without a place there are no times to follow: look again in a few hours.
            let policy: TimelineReloadPolicy = entries.count > 1 ? .atEnd : .after(.now.addingTimeInterval(6 * 3600))
            completion(Timeline(entries: entries, policy: policy))
        }
    }

    static func entries(from now: Date) async -> [QuranWidgetEntry] {
        let settings = SharedRecords.settings.load()
        let language = SystemLanguage(settings.app)
        let store = try? SharedRecords.store()
        let log = (try? await store?.quranLog()) ?? []
        let changes = SystemPrayerBoard(settings: settings, prayers: [:], now: now)?.changes(until: now.addingTimeInterval(36 * 3600)) ?? []
        var entries: [QuranWidgetEntry] = []
        for date in [now] + changes {
            let today = DayKey(date, in: settings.timeZone)
            let times = SystemPrayerBoard(settings: settings, prayers: [:], now: date)?.timeline.days.first { $0.day == today }
            let beforeDawn = Night.isBeforeDawn(date, in: settings.timeZone, today: times)
            let evening = RamadanGlance.evening(today: today, beforeDawn: beforeDawn)
            let tarawih = try? await store?.day(evening).seasons[.tarawih]
            let ramadan = RamadanGlance(today: today, beforeDawn: beforeDawn, offset: settings.app.hijriOffset,
                                        goal: settings.app.ramadanKhatmahGoal, quran: log, tarawih: tarawih)
            entries.append(QuranWidgetEntry(date: date, language: language, quran: QuranGlance(entries: log, today: today), ramadan: ramadan))
        }
        return entries
    }
}

#Preview("Small", as: .systemSmall) {
    QuranWidget()
} timeline: {
    QuranWidgetEntry.sample()
    QuranWidgetEntry.sample(inRamadan: true)
}

#Preview("Medium", as: .systemMedium) {
    QuranWidget()
} timeline: {
    QuranWidgetEntry.sample()
    QuranWidgetEntry.sample(language: SystemLanguage(code: "ar"), inRamadan: true)
}

#Preview("Lock Screen", as: .accessoryRectangular) {
    QuranWidget()
} timeline: {
    QuranWidgetEntry.sample()
}
