import ActivityKit
import AzkarKit
import SwiftUI
import WidgetKit

/// The "Next prayer" Live Activity: the prayer and a live countdown on the Lock Screen and in the
/// Dynamic Island. Once its prayer's time has come it is stale until the app moves it on, and says so.
struct NextPrayerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NextPrayerAttributes.self) { context in
            LiveActivityLockScreenView(state: context.state, isStale: context.isStale)
                .systemLanguage(context.state.language)
                .activityBackgroundTint(Color.azkarAccent.opacity(0.25))
                .activitySystemActionForegroundColor(.azkarAccent)
                .tint(.azkarAccent)
                .widgetURL(SystemRoute.today.url)
        } dynamicIsland: { context in
            let state = context.state
            let language = state.language
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(verbatim: SystemText.prayer(state.prayer, language))
                            .font(.headline)
                    } icon: {
                        Image(systemName: state.prayer.symbolName)
                            .foregroundStyle(.tint)
                    }
                    .systemLanguage(language)
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(verbatim: SystemText.time(state.at, in: state.timeZone, language))
                        .font(.headline.monospacedDigit())
                        .systemLanguage(language)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    LiveActivityCountdown(state: state, isStale: context.isStale)
                        .systemLanguage(language)
                        .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: state.prayer.symbolName)
                    .foregroundStyle(.tint)
                    .accessibilityLabel(Text(verbatim: SystemText.prayer(state.prayer, language)))
            } compactTrailing: {
                LiveActivityCompactCountdown(state: state, isStale: context.isStale)
                    .systemLanguage(language)
            } minimal: {
                ProgressView(timerInterval: state.since...max(state.since, state.at), countsDown: true) {
                    EmptyView()
                } currentValueLabel: {
                    Image(systemName: state.prayer.symbolName)
                        .font(.system(size: 10, weight: .semibold))
                }
                .progressViewStyle(.circular)
                .tint(.azkarAccent)
            }
            .widgetURL(SystemRoute.today.url)
            .keylineTint(.azkarAccent)
        }
    }
}

#Preview("Lock Screen", as: .content, using: NextPrayerAttributes()) {
    NextPrayerLiveActivity()
} contentStates: {
    NextPrayerAttributes.ContentState.preview()
    NextPrayerAttributes.ContentState.preview(language: SystemLanguage(code: "ar"))
}

#Preview("Island", as: .dynamicIsland(.expanded), using: NextPrayerAttributes()) {
    NextPrayerLiveActivity()
} contentStates: {
    NextPrayerAttributes.ContentState.preview()
}
