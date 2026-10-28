import SwiftUI
import WidgetKit

/// Placeholder until the widgets are built; keeps the extension target valid.
struct NextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextPrayer", provider: Provider()) { _ in
            Text("Azkar")
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Next prayer")
        .supportedFamilies([.systemSmall])
    }

    struct Entry: TimelineEntry {
        let date: Date
    }

    struct Provider: TimelineProvider {
        func placeholder(in context: Context) -> Entry { Entry(date: .now) }
        func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: .now)) }
        func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
            completion(Timeline(entries: [Entry(date: .now)], policy: .never))
        }
    }
}
