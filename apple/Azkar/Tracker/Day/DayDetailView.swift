import AzkarKit
import SwiftUI

/// Everything recorded on one day, editable: the obligatory prayers, the sunnah prayers and the
/// fast; with each azkar session, the tasbih counts and the day's prayer times.
struct TrackerDayView: View {
    let data: TrackerData
    let day: DayKey
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let records = data.day(day)
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    if day == data.today {
                        Text("Today", tableName: "Tracker")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.accentColor)
                    }
                    Text(format.fullDay(day))
                        .font(.title3.weight(.semibold))
                    Text(format.hijri(day))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            }

            TrackerDayPrayersSection(data: data, day: day, record: records.prayer)
            TrackerDaySunnahSection(data: data, day: day, record: records.prayer)
            TrackerDayAzkarSection(data: data, day: day, sessions: records.sessions)
            TrackerDayTasbihSection(data: data, records: records)
            TrackerDayFastSection(data: data, day: day, fast: records.fast)
            TrackerDayTimesSection(data: data, day: day)
        }
        .navigationTitle(Text(format.shortDay(day)))
        .navigationBarTitleDisplayMode(.inline)
    }
}

#if DEBUG
#Preview("Day") {
    TrackerPreview(seeded: true) { TrackerDayDetailPreview() }
}

private struct TrackerDayDetailPreview: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    var body: some View {
        let settings = app.settings.settings
        let clock = TrackerClock(now: .now, settings: settings)
        let format = TrackerFormat(base: locale, app: settings.app, timeZone: clock.timeZone)
        NavigationStack {
            TrackerDayView(data: TrackerData(records: app.records.records, clock: clock, format: format, settings: settings, dataset: app.dataset), day: clock.today.adding(days: -1))
        }
        .environment(\.trackerFormat, format)
    }
}
#endif
