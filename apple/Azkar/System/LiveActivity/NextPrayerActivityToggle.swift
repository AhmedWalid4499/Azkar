import SwiftUI

/// A switch for the "Next prayer" Live Activity, for Today (or Settings) to place in a list:
///
/// ```swift
/// Section { NextPrayerActivityToggle() }
/// ```
struct NextPrayerActivityToggle: View {
    @State private var services = SystemServices.shared
    @State private var isOn = SystemServices.shared.liveActivity.isOn

    var body: some View {
        let activity = services.liveActivity
        Toggle(isOn: $isOn) {
            Label {
                Text("Next prayer on the Lock Screen", tableName: SystemText.table)
                if !activity.isAllowed {
                    Text("Live Activities are off for Azkar in the Settings app.", tableName: SystemText.table)
                } else {
                    Text("A countdown on the Lock Screen and in the Dynamic Island.", tableName: SystemText.table)
                }
            } icon: {
                Image(systemName: "platter.2.filled.iphone")
            }
        }
        .disabled(!activity.isAllowed && !isOn)
        .onChange(of: isOn) { _, on in
            guard on != activity.isOn else { return }
            Task { await services.setLiveActivity(on) }
        }
        .onChange(of: activity.isOn) { _, on in isOn = on }
        .sensoryFeedback(.selection, trigger: isOn)
    }
}

#Preview {
    Form { NextPrayerActivityToggle() }
}
