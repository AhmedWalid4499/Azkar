import AzkarKit
import SwiftUI

/// The Tracker tab: everything recorded, in one place. Streaks, the last week and month, missed
/// prayers still owed, a month calendar whose days open in full, the last eight weeks, fasting,
/// all-time totals and the export of it all.
struct TrackerScreen: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @Environment(\.scenePhase) private var scenePhase
    @State private var now = Date.now
    @State private var path: [TrackerRoute] = []

    var body: some View {
        let settings = app.settings.settings
        let clock = TrackerClock(now: now, settings: settings)
        let format = TrackerFormat(base: locale, app: settings.app, timeZone: clock.timeZone)
        let data = TrackerData(records: app.records.records, clock: clock, format: format, settings: settings, dataset: app.dataset)

        NavigationStack(path: $path) {
            TrackerList(data: data, path: $path)
                .navigationTitle(Text("Tracker", tableName: "Tracker"))
                .navigationDestination(for: TrackerRoute.self) { route in
                    switch route {
                    case let .day(day): TrackerDayView(data: data, day: day)
                    case .missed: TrackerMissedPrayersView(data: data)
                    case .trends: TrackerTrendsView(data: data)
                    }
                }
        }
        .environment(\.locale, format.locale)
        .environment(\.trackerFormat, format)
        .environment(\.timeZone, clock.timeZone)
        .task(id: scenePhase) {
            // Today moves on at midnight and the night rule at Fajr: keep the clock current.
            now = .now
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                now = .now
            }
        }
        #if DEBUG
        .task {
            await TrackerSeed.runIfRequested(app)
            let today = TrackerClock(now: .now, settings: app.settings.settings).today
            await TrackerShowcase.exerciseIfRequested(app, today: today)
            if let route = TrackerShowcase.route(today: today) { path = [route] }
        }
        #endif
    }
}

#if DEBUG
#Preview("Tracker") {
    TrackerPreview { TrackerScreen() }
}

#Preview("Tracker, new user") {
    TrackerPreview(seeded: false) { TrackerScreen() }
}
#endif
