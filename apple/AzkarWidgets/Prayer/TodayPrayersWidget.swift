import AzkarKit
import SwiftUI
import WidgetKit

/// "Today's prayers": the day and its five prayers, to tick off from the Lock Screen or the Home
/// Screen as they are prayed. It moves on to the next day at midnight and redraws after every
/// change, from the same timeline as the prayer times widget.
struct TodayPrayersWidget: Widget {
    static let kind = "TodayPrayers"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: PrayerTimesProvider()) { entry in
            TodayPrayersWidgetView(entry: entry)
                .systemLanguage(entry.language)
                .tint(.azkarAccent)
                .containerBackground(for: .widget) { WidgetBackdrop() }
                .widgetURL(SystemRoute.today.url)
        }
        .configurationDisplayName(Text("Today’s prayers", tableName: SystemText.table))
        .description(Text("Today’s date and five prayers, to tick off as you pray them.", tableName: SystemText.table))
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .systemSmall])
    }
}

#Preview("Lock Screen", as: .accessoryRectangular) {
    TodayPrayersWidget()
} timeline: {
    PrayerTimesEntry.sample()
    PrayerTimesEntry.sample(language: SystemLanguage(code: "ar"))
}

#Preview("Small", as: .systemSmall) {
    TodayPrayersWidget()
} timeline: {
    PrayerTimesEntry.sample()
}
