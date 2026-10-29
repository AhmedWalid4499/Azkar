import SwiftUI

/// What a new user sees before anything is recorded: what will gather here, and how.
struct TrackerEmptySection: View {
    var body: some View {
        Section {
            ContentUnavailableView {
                Label {
                    Text("Your tracker begins here", tableName: "Tracker")
                } icon: {
                    Image(systemName: "leaf.fill")
                        .foregroundStyle(.green)
                        .symbolEffect(.breathe, options: .nonRepeating)
                }
            } description: {
                Text("Log each prayer on the Today tab or from a day in the calendar below, tick off the sunnah prayers, read the morning and evening azkar and log your fasts. Your streaks, how the last week and month went, missed prayers to make up, trends and all-time totals will gather here.", tableName: "Tracker")
            }
        }
    }
}

#Preview {
    List { TrackerEmptySection() }
}
