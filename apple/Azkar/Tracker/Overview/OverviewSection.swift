import AzkarKit
import SwiftUI

/// The five prayers' current and best streak, then every other streak.
struct TrackerOverviewSection: View {
    let data: TrackerData

    var body: some View {
        let statsDay = data.clock.statsDay
        let prayers = PrayerStats.streaks(data.history.prayers, today: statsDay)
        Section {
            TrackerAdaptiveStack {
                TrackerStreakFigure(title: Text("Current streak", tableName: "Tracker"), days: prayers.current, symbol: "flame.fill", tint: .orange)
                Divider()
                TrackerStreakFigure(title: Text("Best streak", tableName: "Tracker"), days: prayers.best, symbol: "trophy.fill", tint: .yellow)
            }
            .padding(.vertical, 4)
        } header: {
            Text("Five daily prayers", tableName: "Tracker")
        } footer: {
            Text("A day joins your streak when all five prayers are prayed, on time or made up later. Excused prayers never count against you.", tableName: "Tracker")
        }

        Section {
            ForEach(streakRows) { row in
                TrackerStreakRow(row: row)
            }
        } header: {
            Text("More streaks", tableName: "Tracker")
        }
    }

    private var streakRows: [TrackerStreakRow.Model] {
        let history = data.history
        let today = data.today
        let beforeDawn = data.clock.beforeDawn
        let statsDay = data.clock.statsDay
        let azkar = AzkarStats.streaks(history.sessions, today: today, beforeDawn: beforeDawn)
        var rows: [TrackerStreakRow.Model] = [
            .init(id: "witr", name: SunnahPrayer.witr.trackerName, symbol: SunnahPrayer.witr.trackerSymbol, tint: .indigo,
                  streak: SunnahStats.witrStreaks(history.prayers, today: statsDay)),
            .init(id: "rawatib", name: LocalizedStringResource("Rawatib (12 rak’ahs)", table: "Tracker"), symbol: "square.stack.3d.up.fill", tint: .teal,
                  streak: SunnahStats.rawatibStreaks(history.prayers, today: statsDay)),
            .init(id: "morning", name: AzkarSession.morning.trackerName, symbol: AzkarSession.morning.trackerSymbol, tint: AzkarSession.morning.trackerTint, streak: azkar.morning),
            .init(id: "evening", name: AzkarSession.evening.trackerName, symbol: AzkarSession.evening.trackerSymbol, tint: AzkarSession.evening.trackerTint, streak: azkar.evening),
        ]
        if data.showsSleep {
            rows.append(.init(id: "sleep", name: AzkarSession.sleep.trackerName, symbol: AzkarSession.sleep.trackerSymbol, tint: AzkarSession.sleep.trackerTint,
                              streak: AzkarStats.streak(of: .sleep, in: history.sessions, today: today, beforeDawn: beforeDawn)))
        }
        if !data.afterPrayers.isEmpty {
            let after = AfterPrayerStats.streaks(history.sessions, today: today, beforeDawn: beforeDawn, prayers: data.afterPrayers)
            rows.append(.init(id: "afterPrayer", name: LocalizedStringResource("Azkar after the prayers", table: "Tracker"),
                              symbol: AzkarSession.afterPrayer(.fajr).trackerSymbol, tint: AzkarSession.afterPrayer(.fajr).trackerTint, streak: after.all))
        }
        return rows
    }
}

/// One big figure: a streak in days.
private struct TrackerStreakFigure: View {
    let title: Text
    let days: Int
    let symbol: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label { title } icon: { Image(systemName: symbol).foregroundStyle(tint) }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
            Text("\(days) days", tableName: "Tracker")
                .font(.title.weight(.semibold).monospacedDigit())
                .contentTransition(.numericText(value: Double(days)))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// A named streak: its current run, and its best.
struct TrackerStreakRow: View {
    @Environment(\.trackerFormat) private var format

    struct Model: Identifiable {
        let id: String
        let name: LocalizedStringResource
        let symbol: String
        let tint: Color
        let streak: Streak
    }

    let row: Model

    var body: some View {
        LabeledContent {
            TrackerValueStack {
                Text("\(row.streak.current) days", tableName: "Tracker")
                    .font(.body.monospacedDigit())
                    .foregroundStyle(.primary)
                Text("Best \(row.streak.best)", tableName: "Tracker")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        } label: {
            Label {
                format.text(row.name)
            } icon: {
                Image(systemName: row.symbol).foregroundStyle(row.tint)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(format.text(row.name))
        .accessibilityValue(Text("Current \(row.streak.current) days, best \(row.streak.best) days", tableName: "Tracker"))
    }
}
