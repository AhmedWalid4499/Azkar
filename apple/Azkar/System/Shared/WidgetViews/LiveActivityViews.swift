import ActivityKit
import AzkarKit
import SwiftUI
import WidgetKit

struct LiveActivityLockScreenView: View {
    let state: NextPrayerAttributes.ContentState
    let isStale: Bool

    var body: some View {
        let language = state.language
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Label {
                    Text(verbatim: SystemText.string(isStale || state.at <= .now ? "Now" : state.isTomorrow ? "Tomorrow" : "Next prayer", language))
                } icon: {
                    Image(systemName: state.prayer.symbolName)
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tint)
                Spacer()
                if !state.placeName.isEmpty {
                    Text(verbatim: state.placeName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: SystemText.prayer(state.prayer, language))
                    .font(.title2.weight(.bold))
                Spacer()
                Text(verbatim: SystemText.time(state.at, in: state.timeZone, language))
                    .font(.title3.weight(.semibold).monospacedDigit())
            }
            LiveActivityCountdown(state: state, isStale: isStale)
        }
        .padding()
    }
}

/// The countdown with its progress bar, or once the prayer's time has come, that it has.
struct LiveActivityCountdown: View {
    let state: NextPrayerAttributes.ContentState
    let isStale: Bool

    var body: some View {
        let language = state.language
        if isStale || state.at <= .now {
            Label {
                Text(verbatim: SystemText.format("It’s time for %@", language, SystemText.prayer(state.prayer, language)))
            } icon: {
                Image(systemName: "bell.badge")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.tint)
        } else {
            VStack(spacing: 4) {
                ProgressView(timerInterval: state.since...state.at, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .tint(.azkarAccent)
                HStack {
                    Text(verbatim: SystemText.string("Time remaining", language))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(timerInterval: Date.now...state.at, countsDown: true)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                }
                .font(.subheadline)
            }
            .accessibilityElement(children: .combine)
        }
    }
}

/// The Dynamic Island's compact countdown.
struct LiveActivityCompactCountdown: View {
    let state: NextPrayerAttributes.ContentState
    let isStale: Bool

    var body: some View {
        if isStale || state.at <= .now {
            Image(systemName: "bell.badge.fill")
                .foregroundStyle(.tint)
        } else {
            Text(timerInterval: Date.now...state.at, countsDown: true)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(minWidth: 36, maxWidth: 68)
                .foregroundStyle(.tint)
        }
    }
}

extension NextPrayerAttributes.ContentState {
    static func preview(language: SystemLanguage = SystemLanguage(code: "en")) -> Self {
        Self(prayer: .asr, at: .now.addingTimeInterval(80 * 60), since: .now.addingTimeInterval(-150 * 60), isTomorrow: false,
             language: language, timeZoneID: "Asia/Riyadh", placeName: "Riyadh")
    }
}
