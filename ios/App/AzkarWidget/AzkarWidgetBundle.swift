import SwiftUI
import WidgetKit

/// The widget extension's entry point. The app publishes what the widgets show through
/// AzkarWidgetPlugin; see the README's Mobile app section.
@main
struct AzkarWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrayerTimesWidget()
    }
}
