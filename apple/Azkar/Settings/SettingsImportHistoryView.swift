import AzkarKit
import SwiftUI

/// What was brought in: from the earlier (web-based) Azkar app on this iPhone, and from each
/// backup restored. Kept with the records, so the app can always say where its history came from.
struct SettingsImportHistoryView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var reports: [ImportReport] = []

    var body: some View {
        List {
            ForEach(Array(reports.filter { !$0.isEmpty }.reversed().enumerated()), id: \.offset) { _, report in
                Section {
                    SettingsImportReportRows(report: report)
                } header: {
                    Text(SettingsImportSummary.title(report, locale: locale))
                }
            }
        }
        .overlay {
            if reports.allSatisfy(\.isEmpty) {
                ContentUnavailableView {
                    Label { Text("Nothing imported", tableName: SettingsText.table) } icon: { Image(systemName: "tray") }
                }
            }
        }
        .navigationTitle(Text("Imported data", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: app.importReport) {
            reports = (try? await app.store.importReports()) ?? []
        }
    }
}

/// One import's facts.
private struct SettingsImportReportRows: View {
    let report: ImportReport
    @Environment(\.locale) private var locale

    var body: some View {
        LabeledContent {
            Text(report.at.formatted(Date.FormatStyle(date: .long, time: .shortened).locale(locale)))
        } label: {
            Text("Imported on", tableName: SettingsText.table)
        }
        if let first = report.firstDay, let last = report.lastDay {
            LabeledContent {
                Text(SettingsImportSummary.range(first, last, locale: locale))
            } label: {
                Text("Days covered", tableName: SettingsText.table)
            }
        }
        row("Prayers logged", report.prayers)
        row("Days with prayers", report.prayerDays)
        row("Sunnah prayers", report.sunnahPrayers)
        row("Azkar sessions", report.sessions)
        row("Sessions completed", report.completedSessions)
        row("Fasts", report.fasts)
        row("Azkar recited", report.recitations)
        row("Tasbih count", report.tasbih)
        if !report.settings.isEmpty {
            LabeledContent {
                Text(report.settings.map { SettingsImportSummary.group($0, locale: locale) }.formatted(.list(type: .and).locale(locale)))
                    .multilineTextAlignment(.trailing)
            } label: {
                Text("Settings taken over", tableName: SettingsText.table)
            }
        }
    }

    @ViewBuilder
    private func row(_ title: LocalizedStringKey, _ value: Int) -> some View {
        if value > 0 {
            LabeledContent {
                Text(value.formatted(.number.locale(locale)))
            } label: {
                Text(title, tableName: SettingsText.table)
            }
        }
    }
}

/// Words for an import.
enum SettingsImportSummary {
    static func title(_ report: ImportReport, locale: Locale) -> String {
        report.source == ImportReport.webApp
            ? SettingsText.string("From the earlier Azkar app", locale: locale)
            : SettingsText.string("From a backup file", locale: locale)
    }

    /// "152 prayers, 40 azkar sessions and 3 fasts", or that the file holds no records.
    static func counts(_ report: ImportReport, locale: Locale) -> String {
        var parts: [String] = []
        if report.prayers > 0 { parts.append(SettingsText.string("\(report.prayers) prayers", locale: locale)) }
        if report.sessions > 0 { parts.append(SettingsText.string("\(report.sessions) azkar sessions", locale: locale)) }
        if report.fasts > 0 { parts.append(SettingsText.string("\(report.fasts) fasts", locale: locale)) }
        guard !parts.isEmpty else { return SettingsText.string("It holds settings but no records.", locale: locale) }
        return parts.formatted(.list(type: .and).locale(locale))
    }

    static func range(_ first: DayKey, _ last: DayKey, locale: Locale) -> String {
        let style = Date.FormatStyle(date: .abbreviated, time: .omitted, timeZone: .gmt).locale(locale)
        let from = first.noonUTC.formatted(style)
        let to = last.noonUTC.formatted(style)
        return first == last ? from : SettingsText.string("\(from) to \(to)", locale: locale)
    }

    static func group(_ raw: String, locale: Locale) -> String {
        switch raw {
        case "app": SettingsText.string("settings group \"general\"", locale: locale)
        case "location": SettingsText.string("settings group \"location\"", locale: locale)
        case "calculation": SettingsText.string("settings group \"prayer times\"", locale: locale)
        case "reminders": SettingsText.string("settings group \"reminders\"", locale: locale)
        case "reader": SettingsText.string("settings group \"azkar reader\"", locale: locale)
        default: raw
        }
    }
}
