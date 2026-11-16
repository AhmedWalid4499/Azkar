import AzkarKit
import SwiftUI

/// A month of prayer times as it will print, in the Gregorian or Hijri calendar, shared as a PDF.
struct TimetableView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var kind: TimetableMonth.Kind = .gregorian
    /// `nil` shows the month holding today.
    @State private var chosen: TimetableMonth?
    @State private var width: CGFloat = 0

    private var settings: SettingsSnapshot { app.settings.settings }
    private var today: DayKey { DayKey(.now, in: settings.timeZone) }
    private var month: TimetableMonth { chosen ?? .containing(today, kind: kind, hijriOffset: settings.app.hijriOffset) }

    var body: some View {
        let document = TimetableDocument.make(month: month, settings: settings, locale: locale, today: today)
        ScrollView {
            VStack(spacing: 16) {
                Picker(selection: $kind) {
                    Text("Gregorian", tableName: PrayerExportText.table).tag(TimetableMonth.Kind.gregorian)
                    Text("Hijri", tableName: PrayerExportText.table).tag(TimetableMonth.Kind.hijri)
                } label: {
                    Text("Calendar", tableName: PrayerExportText.table)
                }
                .pickerStyle(.segmented)

                stepper(title: document?.title ?? "")

                if let document {
                    let pages = document.pages
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, rows in
                        preview(TimetablePage(document: document, rows: rows, number: index + 1, count: pages.count))
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .onGeometryChange(for: CGFloat.self) { $0.size.width - 40 } action: { width = $0 }
        }
        .background(Color(.systemGroupedBackground))
        .sensoryFeedback(.selection, trigger: month)
        .onChange(of: kind) { _, newKind in
            // Keep to the same stretch of time when switching calendars.
            guard let shown = chosen else { return }
            let days = shown.days(hijriOffset: settings.app.hijriOffset)
            chosen = days.isEmpty ? nil : .containing(days[days.count / 2], kind: newKind, hijriOffset: settings.app.hijriOffset)
        }
        .toolbar {
            if let document {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: TimetableFile(document: document),
                              preview: SharePreview(Text(document.fileName), image: Image(systemName: "doc.richtext")))
                }
            }
        }
        .navigationTitle(Text("Monthly timetable", tableName: PrayerExportText.table))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func stepper(title: String) -> some View {
        HStack {
            Button {
                chosen = month.adding(months: -1)
            } label: {
                Image(systemName: "chevron.backward")
                    .frame(width: 44, height: 44)
                    .contentShape(.rect)
            }
            .accessibilityLabel(Text("Previous month", tableName: PrayerExportText.table))
            Spacer()
            Text(title)
                .font(.headline)
                .contentTransition(.numericText())
                .onTapGesture { chosen = nil }
            Spacer()
            Button {
                chosen = month.adding(months: 1)
            } label: {
                Image(systemName: "chevron.forward")
                    .frame(width: 44, height: 44)
                    .contentShape(.rect)
            }
            .accessibilityLabel(Text("Next month", tableName: PrayerExportText.table))
        }
        .font(.body.weight(.semibold))
        .buttonStyle(.borderless)
    }

    /// The page as it prints, shrunk to the screen's width.
    private func preview(_ page: TimetablePage) -> some View {
        let size = TimetablePage.size
        let scale = width > 0 ? width / size.width : 0.5
        return page
            .scaleEffect(scale, anchor: .top)
            .frame(width: size.width * scale, height: size.height * scale, alignment: .top)
            .clipShape(.rect(cornerRadius: 4))
            .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
            .accessibilityElement(children: .contain)
    }
}

#Preview {
    NavigationStack { TimetableView() }
        .environment(try! AppEnvironment())
}
