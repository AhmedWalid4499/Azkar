import SwiftUI
import WidgetKit

struct PrayerEntry: TimelineEntry {
    let date: Date
    let content: WidgetContent
    let text: WidgetText

    init(date: Date, snapshot: WidgetSnapshot?) {
        self.date = date
        content = WidgetTimeline.content(of: snapshot, at: date)
        text = WidgetText(snapshot: snapshot)
    }
}

struct PrayerTimesProvider: TimelineProvider {
    var load: () -> WidgetSnapshot? = { WidgetStore.shared()?.snapshot() }

    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), snapshot: SampleSnapshot.make(around: Date()))
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        let now = Date()
        let entry = PrayerEntry(date: now, snapshot: load())
        // The widget gallery shows a made-up day until the app has something to show.
        if context.isPreview, !entry.content.isReady {
            completion(PrayerEntry(date: now, snapshot: SampleSnapshot.make(around: now)))
        } else {
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        completion(Self.timeline(for: load(), from: Date()))
    }

    /// An entry for every change ahead. After the last one WidgetKit asks again; with nothing
    /// ahead the widget waits for the app, which reloads it whenever it publishes.
    static func timeline(for snapshot: WidgetSnapshot?, from now: Date) -> Timeline<PrayerEntry> {
        let entries = WidgetTimeline.entryDates(for: snapshot, from: now).map { PrayerEntry(date: $0, snapshot: snapshot) }
        return Timeline(entries: entries, policy: entries.count > 1 ? .atEnd : .never)
    }
}

struct PrayerTimesWidget: Widget {
    nonisolated static let kind = "PrayerTimes"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: PrayerTimesProvider()) { entry in
            PrayerTimesEntryView(entry: entry)
        }
        .configurationDisplayName(Text("widget.name", bundle: .widget))
        .description(Text("widget.description", bundle: .widget))
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

/// A made-up day at the phone's own place and in its language, for the widget gallery.
enum SampleSnapshot {
    static func make(around now: Date) -> WidgetSnapshot {
        let zone = TimeZone.current
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let formatter = DateFormatter()
        formatter.timeZone = zone
        formatter.timeStyle = .short
        let clock: [(String, Int, Int)] = [("fajr", 5, 10), ("dhuhr", 12, 30), ("asr", 15, 45), ("maghrib", 18, 15), ("isha", 19, 40)]
        let days: [WidgetSnapshot.Day] = (0...1).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: now)) else { return nil }
            let prayers = clock.compactMap { prayer, hour, minute -> WidgetSnapshot.Prayer? in
                guard let at = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) else { return nil }
                return WidgetSnapshot.Prayer(prayer: prayer, at: at.timeIntervalSince1970 * 1000, time: formatter.string(from: at))
            }
            let log = offset == 0 ? ["fajr": "ontime", "dhuhr": "jamaah"] : [:]
            return WidgetSnapshot.Day(date: WidgetTimeline.dateKey(day, in: zone), prayers: prayers, log: log)
        }
        let arabic = Bundle.widget.preferredLocalizations.first == "ar"
        return WidgetSnapshot(
            version: WidgetSnapshot.currentVersion, lang: arabic ? "ar" : "en", arabicDigits: arabic,
            timeZone: zone.identifier, name: "", days: days, labels: [:]
        )
    }
}
