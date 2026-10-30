import AzkarKit
import SwiftUI

/// How the last 7 or 30 days went in one area.
struct TrackerRecentSection: View {
    let data: TrackerData
    let area: TrackerArea
    @Environment(\.trackerFormat) private var format
    @State private var window = Window.week

    enum Window: Int, CaseIterable, Identifiable {
        case week = 7
        case month = 30
        var id: Int { rawValue }
    }

    var body: some View {
        let days = window.rawValue
        let history = data.history
        let statsDay = data.clock.statsDay
        let today = data.today
        let beforeDawn = data.clock.beforeDawn
        Section {
            Picker(selection: $window.animation(.snappy)) {
                ForEach(Window.allCases) { window in
                    Text("\(window.rawValue) days", tableName: "Tracker").tag(window)
                }
            } label: {
                Text("Period", tableName: "Tracker")
            }
            .pickerStyle(.segmented)
            .listRowSeparator(.hidden)
            .sensoryFeedback(.selection, trigger: window)

            switch area {
            case .prayers:
                TrackerRateRow(
                    name: LocalizedStringResource("Obligatory prayers", table: "Tracker"), symbol: "building.columns.fill", tint: .green,
                    rate: PrayerStats.completionRate(history.prayers, today: statsDay, days: days), detail: .prayed
                )
                TrackerRateRow(
                    name: LocalizedStringResource("Sunnah prayers", table: "Tracker"), symbol: "sparkles", tint: .teal,
                    rate: SunnahStats.completion(history.prayers, today: statsDay, days: days).rate, detail: .done
                )
            case .azkar:
                ForEach(dailySessions, id: \.self) { session in
                    TrackerRateRow(
                        name: session.trackerName, symbol: session.trackerSymbol, tint: session.trackerTint,
                        rate: AzkarStats.completionRate(of: session, in: history.sessions, today: today, beforeDawn: beforeDawn, days: days),
                        detail: .completed
                    )
                }
                if !data.afterPrayers.isEmpty {
                    TrackerRateRow(
                        name: LocalizedStringResource("Azkar after the prayers", table: "Tracker"),
                        symbol: AzkarSession.afterPrayer(.fajr).trackerSymbol, tint: AzkarSession.afterPrayer(.fajr).trackerTint,
                        rate: AfterPrayerStats.completionRates(history.sessions, today: today, beforeDawn: beforeDawn, days: days, prayers: data.afterPrayers).all,
                        detail: .completed
                    )
                }
                TrackerCountRow(name: LocalizedStringResource("Tasbih", table: "Tracker"), symbol: "circle.hexagongrid.fill", tint: .brown,
                                count: TasbihStats.count(history.tasbih, today: today, days: days))
            case .quran:
                TrackerCountRow(name: LocalizedStringResource("Pages read", table: "Tracker"), symbol: "book.pages.fill", tint: .green,
                                count: (0..<days).reduce(0) { $0 + data.quran.pages(on: today.adding(days: -$1)) })
            case .fasting:
                TrackerCountRow(name: LocalizedStringResource("Fasts kept", table: "Tracker"), symbol: TrackerMark.fast, tint: .orange, count: data.fastsKept(days: days))
            case .ramadan:
                EmptyView()
            }
        } header: {
            Text("Recent days", tableName: "Tracker")
        }
    }

    private var dailySessions: [AzkarSession] {
        data.showsSleep ? [.morning, .evening, .sleep] : [.morning, .evening]
    }
}

/// A share of what was due, with a gauge.
struct TrackerRateRow: View {
    enum Detail { case prayed, done, completed }

    let name: LocalizedStringResource
    let symbol: String
    let tint: Color
    let rate: CompletionRate
    let detail: Detail
    @Environment(\.trackerFormat) private var format

    var body: some View {
        HStack(spacing: 14) {
            Gauge(value: rate.rate ?? 0) {
                Image(systemName: symbol)
            } currentValueLabel: {
                if let percent = rate.wholePercent {
                    Text(format.number(percent)).lineLimit(1).minimumScaleFactor(0.6)
                } else {
                    Text(verbatim: "–")
                }
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(tint)
            .scaleEffect(0.8)
            .frame(width: 48, height: 48)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                format.text(name)
                detailText
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(rate.rate.map { Text(format.percent($0)) } ?? Text(""))
    }

    private var detailText: Text {
        guard rate.due > 0 else { return Text("Nothing to measure yet", tableName: "Tracker") }
        switch detail {
        case .prayed: return Text("\(rate.done) of \(rate.due) prayed", tableName: "Tracker")
        case .done: return Text("\(rate.done) of \(rate.due) done", tableName: "Tracker")
        case .completed: return Text("\(rate.done) of \(rate.due) completed", tableName: "Tracker")
        }
    }
}

/// A plain count, for what has no "due".
struct TrackerCountRow: View {
    let name: LocalizedStringResource
    let symbol: String
    let tint: Color
    let count: Int
    @Environment(\.trackerFormat) private var format

    var body: some View {
        LabeledContent {
            Text(format.number(count)).monospacedDigit()
        } label: {
            Label { format.text(name) } icon: { Image(systemName: symbol).foregroundStyle(tint) }
        }
    }
}
