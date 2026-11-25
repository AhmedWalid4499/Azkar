import AzkarKit
import SwiftUI

/// Settings › Prayer times: put the times in the Calendar app, take them out, or make a
/// printable month.
struct PrayerExportSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @Environment(\.openURL) private var openURL
    @State private var record = PrayerCalendarRecord.load()
    @State private var working = false
    @State private var confirmingRemove = false
    @State private var problem: Problem?
    @State private var done = 0

    private enum Span { case month, year }

    private enum Problem: Identifiable {
        case denied
        case failed(String)
        var id: String {
            switch self {
            case .denied: "denied"
            case .failed(let message): message
            }
        }
    }

    private var settings: SettingsSnapshot { app.settings.settings }
    private var place: PrayerPlace? { settings.location.flatMap(PrayerPlace.init) }
    private var calendarTitle: String { PrayerExportText.string("Prayer times", locale: locale) }

    var body: some View {
        Section {
            Menu {
                Button { add(.month) } label: { Text("Next month", tableName: PrayerExportText.table) }
                Button { add(.year) } label: { Text("Next 12 months", tableName: PrayerExportText.table) }
            } label: {
                HStack {
                    Text("Add to Calendar", tableName: PrayerExportText.table)
                    Spacer()
                    if working { ProgressView() }
                }
            }
            .disabled(place == nil || working)

            if record != nil {
                Button(role: .destructive) {
                    confirmingRemove = true
                } label: {
                    Text("Remove from Calendar", tableName: PrayerExportText.table)
                }
                .disabled(working)
            }

            NavigationLink {
                TimetableView()
            } label: {
                Text("Monthly timetable", tableName: PrayerExportText.table)
            }
            .disabled(place == nil)
        } header: {
            Text("Calendar and printing", tableName: PrayerExportText.table)
        } footer: {
            Text(footer)
        }
        .task { record = await PrayerCalendarSync.shared.currentRecord() }
        .sensoryFeedback(.success, trigger: done)
        .confirmationDialog(Text("Remove prayer times from Calendar?", tableName: PrayerExportText.table),
                            isPresented: $confirmingRemove, titleVisibility: .visible) {
            Button(role: .destructive) { remove() } label: { Text("Remove from Calendar", tableName: PrayerExportText.table) }
        } message: {
            Text(PrayerExportText.string("The “\(calendarTitle)” calendar and all its prayer times will be deleted.", locale: locale))
        }
        .alert(item: $problem) { problem in
            switch problem {
            case .denied:
                Alert(title: Text("Calendar access is off", tableName: PrayerExportText.table),
                      message: Text("To add and remove prayer times, allow Azkar full access to Calendar in Settings.", tableName: PrayerExportText.table),
                      primaryButton: .default(Text("Open Settings", tableName: PrayerExportText.table)) {
                          if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                      },
                      secondaryButton: .cancel(Text("Cancel", tableName: PrayerExportText.table)))
            case .failed(let message):
                Alert(title: Text("Calendar couldn’t be updated", tableName: PrayerExportText.table),
                      message: Text(message),
                      dismissButton: .default(Text("OK", tableName: PrayerExportText.table)))
            }
        }
    }

    private var footer: String {
        guard let location = settings.location, place != nil else {
            return PrayerExportText.string("Set a location to add prayer times to Calendar or make a timetable.", locale: locale)
        }
        // Once the added days have passed, say what adding does again.
        guard let record, record.last >= DayKey(.now, in: location.zone) else {
            return PrayerExportText.string("Adds the five prayers as events in a calendar of their own named “\(calendarTitle)”, with the method and adjustments above. Adding again replaces them.", locale: locale)
        }
        let format = TodayFormat(locale: locale, timeZone: location.zone, settings: settings.app)
        return PrayerExportText.string("Prayer times are in your Calendar until \(format.longDay(record.last)). After changing the method, adjustments or location, add them again to update them.", locale: locale)
    }

    private func add(_ span: Span) {
        guard let plan = Self.plan(months: span == .month ? 1 : 12, settings: settings, locale: locale) else { return }
        run { record = try await PrayerCalendarSync.shared.add(plan) }
    }

    /// The prayers from today for `months` months, at the saved place with the person's method and
    /// adjustments, titled in the interface language.
    static func plan(months: Int, settings: SettingsSnapshot, locale: Locale) -> PrayerCalendarPlan? {
        guard let location = settings.location, let place = PrayerPlace(location) else { return nil }
        let today = DayKey(.now, in: place.timeZone)
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = .gmt
        let end = gregorian.date(byAdding: .month, value: months, to: today.noonUTC) ?? today.noonUTC
        let count = max(1, today.days(to: DayKey(end, in: .gmt)))
        let days = PrayerCalculator.days(from: today, count: count, at: place, config: settings.calculation)
        let format = TodayFormat(locale: locale, timeZone: place.timeZone, settings: settings.app)
        let method = SettingsText.method(settings.calculation.resolved(at: place).method, locale: locale)
        return PrayerCalendarPlan.make(days: days, title: { SettingsText.prayer($0, locale: locale) },
                                       calendarTitle: PrayerExportText.string("Prayer times", locale: locale),
                                       notes: "\(format.place(location)) · \(method)")
    }

    private func remove() {
        run {
            try await PrayerCalendarSync.shared.remove()
            record = nil
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        working = true
        Task {
            defer { working = false }
            do {
                try await work()
                done += 1
            } catch PrayerCalendarSync.Failure.denied {
                problem = .denied
            } catch {
                problem = .failed(error.localizedDescription)
            }
        }
    }
}
