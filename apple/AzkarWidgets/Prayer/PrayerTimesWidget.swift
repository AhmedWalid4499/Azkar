import AzkarKit
import SwiftUI
import WidgetKit

/// The prayer times widget: the next prayer and its countdown (small), with today's five prayers to
/// tick off (medium), and the day's azkar too (large); on the Lock Screen, the next prayer and its
/// countdown. Works in StandBy and in the tinted and clear Home Screen styles.
struct PrayerTimesWidget: Widget {
    static let kind = "PrayerTimes"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: PrayerTimesProvider()) { entry in
            PrayerTimesWidgetView(entry: entry)
                .systemLanguage(entry.language)
                .tint(.azkarAccent)
                .containerBackground(for: .widget) { WidgetBackdrop() }
                .widgetURL(SystemRoute.today.url)
        }
        .configurationDisplayName(Text("Prayer times", tableName: SystemText.table))
        .description(Text("The next prayer with a countdown, and today’s prayers to tick off.", tableName: SystemText.table))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

#Preview("Small", as: .systemSmall) {
    PrayerTimesWidget()
} timeline: {
    PrayerTimesEntry.sample()
    PrayerTimesEntry.sample(language: SystemLanguage(code: "ar"))
}

#Preview("Medium", as: .systemMedium) {
    PrayerTimesWidget()
} timeline: {
    PrayerTimesEntry.sample()
    PrayerTimesEntry.sample(language: SystemLanguage(code: "ar"))
}

#Preview("Large", as: .systemLarge) {
    PrayerTimesWidget()
} timeline: {
    PrayerTimesEntry.sample()
    PrayerTimesEntry.sample(language: SystemLanguage(code: "ar"))
}

#Preview("Lock Screen", as: .accessoryRectangular) {
    PrayerTimesWidget()
} timeline: {
    PrayerTimesEntry.sample()
}

#Preview("Circular", as: .accessoryCircular) {
    PrayerTimesWidget()
} timeline: {
    PrayerTimesEntry.sample()
}
