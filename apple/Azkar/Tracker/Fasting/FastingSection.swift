import AzkarKit
import SwiftUI

/// Fasting at a glance: this year's Ramadan, the days still owed and those made up, voluntary
/// fasts this Hijri month and year, the Monday–Thursday and white-days streaks, and the way to
/// log a make-up fast.
struct TrackerFastingSection: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format
    @State private var loggingQada = false

    var body: some View {
        let stats = data.fasting
        let ramadan = stats.ramadan
        Section {
            LabeledContent {
                Text("\(ramadan.fasted) of \(ramadan.days.count)", tableName: "Tracker").monospacedDigit()
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ramadan \(HijriFormat.year(HijriDate(year: ramadan.year, month: HijriDate.ramadan, day: 1), locale: format.display))", tableName: "Tracker")
                        Group {
                            if ramadan.ongoing {
                                Text("Under way: \(ramadan.unlogged) days not logged yet", tableName: "Tracker")
                            } else if ramadan.notFasted > 0 {
                                Text("\(ramadan.notFasted) days not fasted", tableName: "Tracker")
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "moon.stars.fill").foregroundStyle(.indigo)
                }
            }
            .accessibilityElement(children: .combine)

            LabeledContent {
                Text("\(stats.owed.remaining) days", tableName: "Tracker")
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(stats.owed.remaining > 0 ? Color.primary : Color.secondary)
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Still to make up", tableName: "Tracker")
                        Text("Made up: \(stats.owed.madeUp)", tableName: "Tracker")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "arrow.uturn.backward.circle.fill").foregroundStyle(.orange)
                }
            }
            .accessibilityElement(children: .combine)

            LabeledContent {
                TrackerValueStack {
                    Text("\(stats.voluntary.month) this month", tableName: "Tracker")
                    Text("\(stats.voluntary.year) this year", tableName: "Tracker")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } label: {
                Label { Text("Voluntary fasts", tableName: "Tracker") } icon: { Image(systemName: "heart.circle.fill").foregroundStyle(.pink) }
            }
            .accessibilityElement(children: .combine)

            TrackerFastStreakRow(name: Text("Mondays and Thursdays", tableName: "Tracker"), symbol: "calendar.badge.checkmark", tint: .teal,
                          current: Text("\(stats.mondayThursday.current) fasts", tableName: "Tracker"),
                          best: Text("Best \(stats.mondayThursday.best)", tableName: "Tracker"))
            TrackerFastStreakRow(name: Text("White days", tableName: "Tracker"), symbol: "moonphase.full.moon", tint: .yellow,
                          current: Text("\(stats.whiteDays.current) months", tableName: "Tracker"),
                          best: Text("Best \(stats.whiteDays.best)", tableName: "Tracker"))

            Button {
                loggingQada = true
            } label: {
                Label { Text("Log a make-up fast", tableName: "Tracker") } icon: { Image(systemName: "plus.circle.fill") }
            }
            .sheet(isPresented: $loggingQada) {
                TrackerQadaFastSheet(data: data)
            }
            #if DEBUG
            .task {
                guard TrackerShowcase.opensQada else { return }
                try? await Task.sleep(for: .seconds(1.5))
                loggingQada = true
            }
            #endif
        } header: {
            Text("Fasting", tableName: "Tracker")
        } footer: {
            Text("Every day of Ramadan logged as not fasted is added to what you owe, and every make-up fast kept takes one off.", tableName: "Tracker")
        }
    }
}

private struct TrackerFastStreakRow: View {
    let name: Text
    let symbol: String
    let tint: Color
    let current: Text
    let best: Text

    var body: some View {
        LabeledContent {
            TrackerValueStack {
                current
                best.font(.caption).foregroundStyle(.secondary)
            }
        } label: {
            Label { name } icon: { Image(systemName: symbol).foregroundStyle(tint) }
        }
        .accessibilityElement(children: .combine)
    }
}
