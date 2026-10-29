import AzkarKit
import Charts
import SwiftUI

/// One weekly figure of the trends.
struct TrackerTrendSeries: Identifiable {
    let id: String
    let title: LocalizedStringResource
    let symbol: String
    let tint: Color
    /// The most a week can hold, or `nil` when there is no ceiling worth drawing.
    let weeklyMaximum: Int?
    let value: (WeekTotals) -> Int

    static func all(for data: TrackerData) -> [TrackerTrendSeries] {
        var series: [TrackerTrendSeries] = [
            TrackerTrendSeries(id: "prayed", title: LocalizedStringResource("Obligatory prayers prayed", table: "Tracker"), symbol: "building.columns.fill",
                        tint: .green, weeklyMaximum: TrackerStats.DailyMaximum.prayed * 7, value: \.prayed),
            TrackerTrendSeries(id: "sunnah", title: LocalizedStringResource("Sunnah prayers", table: "Tracker"), symbol: "sparkles",
                        tint: .teal, weeklyMaximum: TrackerStats.DailyMaximum.sunnah * 7, value: \.sunnah),
            TrackerTrendSeries(id: "azkar", title: LocalizedStringResource("Morning and evening azkar completed", table: "Tracker"), symbol: "sun.horizon.fill",
                        tint: .orange, weeklyMaximum: TrackerStats.DailyMaximum.azkar * 7, value: \.azkar),
        ]
        if data.showsSleep {
            series.append(TrackerTrendSeries(id: "sleep", title: LocalizedStringResource("Azkar before sleep completed", table: "Tracker"), symbol: AzkarSession.sleep.trackerSymbol,
                                      tint: .purple, weeklyMaximum: TrackerStats.DailyMaximum.sleep * 7, value: \.sleep))
        }
        if !data.afterPrayers.isEmpty {
            series.append(TrackerTrendSeries(id: "afterPrayer", title: LocalizedStringResource("Azkar after the prayers completed", table: "Tracker"),
                                      symbol: AzkarSession.afterPrayer(.fajr).trackerSymbol, tint: .mint, weeklyMaximum: data.afterPrayers.count * 7, value: \.afterPrayer))
        }
        series.append(TrackerTrendSeries(id: "fasted", title: LocalizedStringResource("Fasts kept", table: "Tracker"), symbol: TrackerMark.fast,
                                  tint: .pink, weeklyMaximum: 7, value: \.fasted))
        return series
    }
}

extension TrackerData {
    /// The last eight weeks, oldest first, weeks starting where the user's region starts them.
    var weeks: [WeekTotals] {
        TrackerStats.weeklyTotals(history, today: clock.today, weekStart: format.firstWeekday, weeks: 8)
    }
}

/// The last eight weeks of each figure, one chart each.
struct TrackerTrendsView: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let weeks = data.weeks
        List {
            Section {
                Text("Each bar is a week starting on \(format.weekdayName(format.firstWeekday)). The last, lighter bar is this week so far.", tableName: "Tracker")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            ForEach(TrackerTrendSeries.all(for: data)) { series in
                Section {
                    TrackerWeeklyChart(series: series, weeks: weeks)
                        .frame(height: 180)
                        .padding(.vertical, 8)
                } header: {
                    Label { format.text(series.title) } icon: { Image(systemName: series.symbol).foregroundStyle(series.tint) }
                } footer: {
                    if let maximum = series.weeklyMaximum {
                        Text("Out of \(maximum) a week", tableName: "Tracker")
                    }
                }
            }
        }
        .navigationTitle(Text("Last 8 weeks", tableName: "Tracker"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// A bar per week; the week under way is lighter.
struct TrackerWeeklyChart: View {
    let series: TrackerTrendSeries
    let weeks: [WeekTotals]
    var compact = false
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let peak = weeks.map(series.value).max() ?? 0
        let top = max(series.weeklyMaximum ?? peak, peak, 1)
        Chart(weeks, id: \.start) { week in
            BarMark(
                x: .value(format.string(LocalizedStringResource("Week", table: "Tracker")), format.weekLabel(week.start)),
                y: .value(format.string(series.title), series.value(week))
            )
            .foregroundStyle(series.tint.opacity(week.current ? 0.45 : 1))
            .cornerRadius(4)
        }
        .chartYScale(domain: 0...top)
        .chartXAxis(compact ? .hidden : .automatic)
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: compact ? 2 : 4)) { value in
                AxisGridLine()
                AxisValueLabel {
                    if let count = value.as(Int.self) { Text(format.number(count)) }
                }
            }
        }
        .accessibilityChartDescriptor(TrackerWeeklyChartDescriptor(series: series, weeks: weeks, format: format, top: top))
    }
}

/// What VoiceOver's audio graph and chart summary read.
struct TrackerWeeklyChartDescriptor: AXChartDescriptorRepresentable {
    let series: TrackerTrendSeries
    let weeks: [WeekTotals]
    let format: TrackerFormat
    let top: Int

    func makeChartDescriptor() -> AXChartDescriptor {
        let labels = weeks.map { format.weekLabel($0.start) }
        let xAxis = AXCategoricalDataAxisDescriptor(title: format.string(LocalizedStringResource("Week", table: "Tracker")), categoryOrder: labels)
        let yAxis = AXNumericDataAxisDescriptor(title: format.string(series.title), range: 0...Double(top), gridlinePositions: []) { value in
            format.number(Int(value))
        }
        let points = weeks.map { week in
            AXDataPoint(x: format.weekLabel(week.start), y: Double(series.value(week)),
                        label: week.current ? format.string(LocalizedStringResource("This week so far", table: "Tracker")) : nil)
        }
        let total = weeks.map(series.value).reduce(0, +)
        return AXChartDescriptor(
            title: format.string(series.title),
            summary: format.string(LocalizedStringResource("\(total) in the last 8 weeks", table: "Tracker")),
            xAxis: xAxis, yAxis: yAxis, additionalAxes: [],
            series: [AXDataSeriesDescriptor(name: format.string(series.title), isContinuous: false, dataPoints: points)]
        )
    }
}

/// The trends' way in on the main page: the prayers' eight weeks at a glance.
struct TrackerTrendsSummarySection: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let series = TrackerTrendSeries.all(for: data)[0]
        Section {
            NavigationLink(value: TrackerRoute.trends) {
                VStack(alignment: .leading, spacing: 8) {
                    format.text(series.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    TrackerWeeklyChart(series: series, weeks: data.weeks, compact: true)
                        .frame(height: 70)
                        .allowsHitTesting(false)
                }
                .padding(.vertical, 4)
            }
        } header: {
            Text("Last 8 weeks", tableName: "Tracker")
        }
    }
}
