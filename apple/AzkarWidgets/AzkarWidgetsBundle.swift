import SwiftUI
import WidgetKit

@main
struct AzkarWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrayerTimesWidget()
        TodayPrayersWidget()
        QuranWidget()
        NextPrayerLiveActivity()
        LogPrayerControl()
        OpenQiblaControl()
    }
}
