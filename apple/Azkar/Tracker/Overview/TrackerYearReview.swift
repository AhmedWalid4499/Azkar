import AzkarKit
import Charts
import SwiftUI

/// The way into the year's review from the main page.
struct TrackerYearRow: View {
    let data: TrackerData

    var body: some View {
        let offset = data.settings.app.hijriOffset
        let year = HijriCalendar.date(of: data.today, offset: offset).year
        let review = HijriYearReview(hijriYear: year, offset: offset, today: data.today, history: data.history)
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text("Year in review", tableName: "Tracker")
                Text("Prayers \(review.prayed), pages \(review.pages)", tableName: "Tracker")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: "calendar.badge.checkmark").foregroundStyle(.brown)
        }
    }
}

/// One Hijri year of everything recorded, the current one so far by default.
struct TrackerYearReviewView: View {
    let data: TrackerData
    /// The year on show; `nil` follows the current one.
    @State private var chosen: Int?
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let offset = data.settings.app.hijriOffset
        let current = HijriCalendar.date(of: data.today, offset: offset).year
        let years = data.history.reviewYears(current: current, today: data.today, offset: offset)
        let year = chosen ?? current
        let review = HijriYearReview(hijriYear: year, offset: offset, today: data.today, history: data.history)
        ScrollViewReader { reader in
        List {
            Section {
                Text("Days with a record: \(review.activeDays) of \(review.daysSoFar)", tableName: "Tracker")
                    .monospacedDigit()
            } header: {
                if review.isFinished {
                    Text(verbatim: yearName(year))
                } else {
                    Text("Year so far", tableName: "Tracker")
                }
            }
            if review.hasAnyRecord {
                TrackerYearSections(data: data, review: review)
            } else {
                Text("Nothing recorded in this year.", tableName: "Tracker")
                    .foregroundStyle(.secondary)
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        #if DEBUG
        .task {
            guard TrackerShowcase.scrollTarget == "months" else { return }
            try? await Task.sleep(for: .milliseconds(400))
            reader.scrollTo("months", anchor: .top)
        }
        #endif
        }
        .navigationTitle(Text(verbatim: yearName(year)))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if years.count > 1 {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker(selection: Binding(get: { year }, set: { chosen = $0 })) {
                            ForEach(years, id: \.self) { Text(verbatim: yearName($0)).tag($0) }
                        } label: {
                            Text("Choose a year", tableName: "Tracker")
                        }
                    } label: {
                        Label { Text("Choose a year", tableName: "Tracker") } icon: { Image(systemName: "calendar") }
                    }
                }
            }
        }
    }

    private func yearName(_ year: Int) -> String {
        HijriFormat.year(HijriDate(year: year, month: HijriDate.muharram, day: 1), locale: format.display)
    }
}

/// The figures of a year with anything in it, each area in the order of the main page. A figure
/// that stayed at zero is left out, the first of each area apart.
private struct TrackerYearSections: View {
    let data: TrackerData
    let review: HijriYearReview
    @Environment(\.trackerFormat) private var format

    var body: some View {
        Section {
            TrackerTotalRow(name: LocalizedStringResource("Prayers prayed", table: "Tracker"), symbol: TrackerArea.prayers.symbol, tint: .green, value: review.prayed) {
                Text(prayerBreakdown)
            }
            if review.completeDays > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Complete days", table: "Tracker"), symbol: "checkmark.circle.fill", tint: .green, value: review.completeDays)
            }
            if review.bestStreak > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Best streak", table: "Tracker"), symbol: "flame.fill", tint: .orange, value: review.bestStreak)
            }
            if review.sunnah > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Sunnah prayers", table: "Tracker"), symbol: "sparkles", tint: .teal, value: review.sunnah)
            }
            if review.prayers.missed > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Missed", table: "Tracker"), symbol: PrayerStatus.missed.symbolName, tint: .red, value: review.prayers.missed)
            }
        } header: {
            format.text(TrackerArea.prayers.title)
        }
        Section {
            TrackerTotalRow(name: LocalizedStringResource("Azkar sessions completed", table: "Tracker"), symbol: TrackerArea.azkar.symbol, tint: .indigo, value: review.sessionsCompleted) {
                Text(sessionBreakdown)
            }
            if review.recitations > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Recitations", table: "Tracker"), symbol: "text.book.closed.fill", tint: .purple, value: review.recitations)
            }
            if review.tasbih > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Tasbih", table: "Tracker"), symbol: "circle.hexagongrid.fill", tint: .brown, value: review.tasbih)
            }
        } header: {
            format.text(TrackerArea.azkar.title)
        }
        Section {
            TrackerTotalRow(name: LocalizedStringResource("Pages read", table: "Tracker"), symbol: TrackerArea.quran.symbol, tint: .green, value: review.pages)
            if review.quranDays > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Days reading", table: "Tracker"), symbol: "calendar", tint: .teal, value: review.quranDays)
            }
            if review.khatmahs > 0 {
                TrackerTotalRow(name: LocalizedStringResource("Khatmahs", table: "Tracker"), symbol: "checkmark.seal.fill", tint: .teal, value: review.khatmahs)
            }
        } header: {
            format.text(TrackerArea.quran.title)
        }
        if review.fastsKept > 0 || review.tarawih > 0 || review.eidPrayers > 0 {
            Section {
                ForEach(fastRows, id: \.kind) { row in
                    TrackerTotalRow(name: row.name, symbol: TrackerMark.fast, tint: .orange, value: row.count)
                }
                if review.tarawih > 0 {
                    TrackerTotalRow(name: LocalizedStringResource("Tarawih nights", table: "Tracker"), symbol: "moon.stars.fill", tint: .indigo, value: review.tarawih)
                }
                if review.eidPrayers > 0 {
                    TrackerTotalRow(name: LocalizedStringResource("Eid prayers", table: "Tracker"), symbol: "sparkle", tint: .indigo, value: review.eidPrayers)
                }
            } header: {
                format.text(TrackerArea.fasting.title)
            }
        }
        TrackerYearMonthsSection(review: review)
    }

    private var fastRows: [(kind: FastKind, name: LocalizedStringResource, count: Int)] {
        let rows: [(FastKind, LocalizedStringResource)] = [
            (.ramadan, LocalizedStringResource("Ramadan fasts", table: "Tracker")),
            (.voluntary, LocalizedStringResource("Voluntary fasts", table: "Tracker")),
            (.qada, LocalizedStringResource("Make-up fast", table: "Tracker")),
        ]
        return rows.compactMap { kind, name in
            review.fasts[kind].map { (kind, name, $0) }
        }
    }

    private var prayerBreakdown: String {
        [
            format.string(LocalizedStringResource("On time \(review.prayers.ontime)", table: "Tracker")),
            format.string(LocalizedStringResource("In congregation \(review.prayers.jamaah)", table: "Tracker")),
            format.string(LocalizedStringResource("Late \(review.prayers.late)", table: "Tracker")),
        ].joined(separator: " · ")
    }

    private var sessionBreakdown: String {
        let afterPrayer = data.afterPrayers.reduce(0) { $0 + (review.sessions[.afterPrayer($1)] ?? 0) }
        var parts = [
            format.string(LocalizedStringResource("Morning \(review.sessions[.morning] ?? 0)", table: "Tracker")),
            format.string(LocalizedStringResource("Evening \(review.sessions[.evening] ?? 0)", table: "Tracker")),
        ]
        if data.showsSleep { parts.append(format.string(LocalizedStringResource("Before sleep \(review.sessions[.sleep] ?? 0)", table: "Tracker"))) }
        if !data.afterPrayers.isEmpty { parts.append(format.string(LocalizedStringResource("After prayers \(afterPrayer)", table: "Tracker"))) }
        return parts.joined(separator: " · ")
    }
}

/// The prayers of each month as bars, then a line for each month with anything in it.
private struct TrackerYearMonthsSection: View {
    let review: HijriYearReview
    @Environment(\.trackerFormat) private var format

    var body: some View {
        Section {
            Chart(review.months) { month in
                BarMark(x: .value(Text("Month", tableName: "Tracker"), format.number(month.month)), y: .value(Text("Prayers prayed", tableName: "Tracker"), month.prayed))
                    .foregroundStyle(.green)
                    .cornerRadius(3)
            }
            .chartYAxis(.hidden)
            .frame(height: 110)
            .accessibilityLabel(Text("Prayers prayed by month", tableName: "Tracker"))
            ForEach(review.months.filter(\.hasAnyRecord)) { month in
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: HijriFormat.monthName(month.month, language: format.display.language))
                    Text("Prayers \(month.prayed), azkar \(month.sessions), pages \(month.pages)", tableName: "Tracker")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
        } header: {
            Text("Month by month", tableName: "Tracker")
        }
        .id("months")
    }
}
