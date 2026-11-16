import AzkarKit
import SwiftUI

/// On Today while menstrual mode is on: which day of it this is, the guide, and a way to turn it off.
struct MenstrualNoticeSection: View {
    @Environment(AppEnvironment.self) private var app
    let context: TodayContext
    @State private var showsGuide = false
    @State private var confirmsOff = false

    var body: some View {
        if let since = app.settings.settings.app.menstrualSince {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center, spacing: 12) {
                        MenstrualBadge(size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(M("Menstrual mode")).font(.headline)
                            Text(M("Day \(MenstrualMode.dayNumber(since: since, now: context.now, in: context.timeZone)) · Prayers are excused and their reminders paused."))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    HStack(spacing: 10) {
                        Button {
                            showsGuide = true
                        } label: {
                            Text(M("Guide")).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        Button {
                            confirmsOff = true
                        } label: {
                            Text(M("Turn off")).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                    .tint(.menstrual)
                }
                .padding(.vertical, 4)
            }
            .listRowBackground(Color.menstrualWash)
            .sheet(isPresented: $showsGuide) { MenstrualGuideSheet().appDirection() }
            #if DEBUG
            .task { if UserDefaults.standard.string(forKey: "TodayShow") == "menstrualGuide" { showsGuide = true } }
            #endif
            .confirmationDialog(Text(M("Turn off menstrual mode?")), isPresented: $confirmsOff, titleVisibility: .visible) {
                Button {
                    Task { await MenstrualMode.turnOff(app) }
                } label: {
                    Text(M("Turn off"))
                }
            } message: {
                Text(M("Prayer reminders come back. If a prayer’s time is still running, it’s no longer marked as excused, so you can pray it."))
            }
        }
    }
}
