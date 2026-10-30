import AzkarKit
import SwiftUI
import UIKit

/// The Today tab: greeting and dates, the next prayer, today's prayers to log, the azkar of
/// the moment, sunnah prayers and fasting. Calm and instant: nothing ticks except the
/// countdowns, and the screen moves on by itself at midnight, at every prayer time and when it
/// comes back from the background.
struct TodayScreen: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var baseLocale
    @Environment(\.scenePhase) private var scenePhase
    @State private var clock = TodayClock()
    @State private var cache = ScheduleCache()
    @State private var showsLocation = false
    @State private var showsCalendar = false
    @State private var showsSettings = TodayScreen.opensSettings

    var body: some View {
        let settings = app.settings.settings
        let context = TodayContext(now: clock.now, settings: settings, cache: cache)
        let format = TodayFormat(locale: baseLocale, timeZone: context.timeZone, settings: settings.app)

        NavigationStack {
            ScrollViewReader { proxy in
                sections(context)
                    #if DEBUG
                    .task { await TodayDebugSeed.present(scroll: proxy, location: $showsLocation, calendar: $showsCalendar) }
                    #endif
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(.compact)
            .navigationTitle(Text(L("Today")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showsLocation) { LocationSheet() }
            .sheet(isPresented: $showsSettings) { SettingsScreen { showsSettings = false } }
            .navigationDestination(isPresented: $showsCalendar) { IslamicCalendarScreen(today: context.today) }
        }
        .environment(\.locale, format.locale)
        .environment(\.todayFormat, format)
        // Wake for the next moment that changes anything; the id restarts the wait after each move.
        .task(id: context.nextBoundary) {
            let wait = clock.realDate(for: context.nextBoundary).timeIntervalSinceNow + 0.5
            try? await Task.sleep(for: .seconds(max(0.5, wait)))
            if !Task.isCancelled { clock.refresh() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { clock.refresh() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            clock.refresh()
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSSystemTimeZoneDidChange)) { _ in
            clock.refresh()
        }
        #if DEBUG
        .task { await TodayDebugSeed.runIfRequested(app) }
        #endif
    }

    /// Header, next prayer (or the first-run card), the season, tarawih, fasting, prayers, azkar, sunnah.
    private func sections(_ context: TodayContext) -> some View {
        List {
            TodayHeader(context: context, showsLocation: $showsLocation, showsCalendar: $showsCalendar, showsSettings: $showsSettings)

            if context.location == nil {
                LocationPromptCard()
            } else if context.locationUnusable {
                UnusableLocationCard(showsLocation: $showsLocation)
            } else if let schedule = context.schedule {
                NextPrayerCard(schedule: schedule, context: context, clock: clock)
            }

            SeasonSection(context: context, showsCalendar: $showsCalendar)

            TarawihSection(context: context)

            FastingSection(context: context, clock: clock)

            if context.schedule != nil {
                PrayersSection(context: context)
            }

            AzkarSection(context: context)

            if !context.locationUnusable {
                SunnahSection(context: context)
            }
        }
    }
}

private extension TodayScreen {
    /// DEBUG builds open Settings at launch with `-AzkarTab settings`, for screenshots.
    static var opensSettings: Bool {
        #if DEBUG
        UserDefaults.standard.string(forKey: "AzkarTab") == "settings"
        #else
        false
        #endif
    }
}

#if DEBUG
#Preview("Today") {
    TodayPreview()
}
#endif
