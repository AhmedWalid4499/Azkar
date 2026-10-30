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

    /// The figures of an area.
    static func all(for data: TrackerData, area: TrackerArea) -> [TrackerTrendSeries] {
        let series = all(for: data)
        switch area {
        case .prayers: return series.filter { ["prayed", "sunnah"].contains($0.id) }
        case .azkar: return series.filter { ["azkar", "sleep", "afterPrayer"].contains($0.id) }
        case .fasting: return series.filter { $0.id == "fasted" }
        case .ramadan: return []
        case .quran:
            let pages = data.quran.pagesByDay
            return [TrackerTrendSeries(id: "pages", title: LocalizedStringResource("Pages read", table: "Tracker"), symbol: "book.pages.fill", tint: .green, weeklyMaximum: nil) { week in
                (0..<7).reduce(0) { $0 + (pages[week.start.adding(days: $1)] ?? 0) }
            }]
        }
    }

    private static func all(for data: TrackerData) -> [TrackerTrendSeries] {
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

/// The last eight weeks of each of an area's figures, one chart each.
struct TrackerTrendSections: View {
    let data: TrackerData
    let area: TrackerArea
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let weeks = data.weeks
        ForEach(TrackerTrendSeries.all(for: data, area: area)) { series in
            Section {
                TrackerWeeklyChart(series: series, weeks: weeks)
                    .frame(height: 150)
                    .padding(.vertical, 8)
            } header: {
                Label { format.text(series.title) } icon: { Image(systemName: series.symbol).foregroundStyle(series.tint) }
            } footer: {
                if let maximum = series.weeklyMaximum {
                    Text("Last 8 weeks, out of \(maximum) a week", tableName: "Tracker")
                } else {
                    Text("Last 8 weeks", tableName: "Tracker")
                }
            }
        }
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
