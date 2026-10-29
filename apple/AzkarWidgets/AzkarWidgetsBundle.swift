import SwiftUI
import WidgetKit

@main
struct AzkarWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrayerTimesWidget()
        NextPrayerLiveActivity()
        LogPrayerControl()
        OpenQiblaControl()
    }
}
