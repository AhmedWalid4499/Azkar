import AzkarKit
import SwiftUI

/// The Azkar tab's first screen: the day's sessions with how far each got, the recommended one
/// marked, the after-prayer azkar of each prayer, and the tasbih counter.
struct SessionPickerView: View {
    @Environment(ReadingContext.self) private var context

    var body: some View {
        // The recommended session and the night's day turn over at the prayer times.
        TimelineView(.everyMinute) { timeline in
            let clock = ReadingClock(now: timeline.date, settings: context.settings.settings)
            List {
                let daily = context.dailySessions
                if daily.isEmpty {
                    ContentUnavailableView {
                        Label { Text("No azkar are available yet.", tableName: "Reading") } icon: {
                            Image(systemName: "book.closed")
                        }
                    }
                    .listRowBackground(Color.clear)
                } else {
                    Section {
                        ForEach(daily, id: \.self) { session in
                            SessionRow(session: session, day: clock.day(for: session), recommended: clock.recommendedSession == session)
                        }
                    }
                }

                let afterPrayer = context.afterPrayerSessions
                if !afterPrayer.isEmpty {
                    Section {
                        ForEach(afterPrayer, id: \.self) { session in
                            SessionRow(session: session, day: clock.day(for: session), recommended: false)
                        }
                    } header: {
                        Text("After prayer", tableName: "Reading")
                    } footer: {
                        Text("Said after the closing salam of each obligatory prayer", tableName: "Reading")
                    }
                }

                Section {
                    TasbihRow(day: clock.tasbihDay)
                }
            }
            .listSectionSpacing(.compact)
        }
        .navigationTitle(Text("Azkar", tableName: "Reading"))
    }
}

#Preview {
    ReadingPreview { SessionPickerView() }
}
