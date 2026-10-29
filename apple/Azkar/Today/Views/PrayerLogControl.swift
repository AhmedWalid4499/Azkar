import AzkarKit
import SwiftUI

/// Logs one obligatory prayer on one day. A tap on an unlogged prayer logs it "on time"; a
/// long press, or a tap once it is logged, offers every status and "Clear". VoiceOver gets the
/// same choices as actions. Each status has its own symbol, so it never rests on colour.
struct PrayerLogControl: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let prayer: Prayer
    let day: DayKey
    /// Called when the user changes the entry here (the "last night's Isha" row stays on show then).
    var onChange: () -> Void = {}

    @State private var logged = 0
    @State private var changed = 0

    private var status: PrayerStatus? {
        app.records.records.prayers[day]?.prayers[prayer]?.status
    }

    var body: some View {
        let status = status
        Group {
            if status == nil {
                Menu {
                    choices(current: nil)
                } label: {
                    icon(nil)
                } primaryAction: {
                    set(.ontime)
                }
            } else {
                Menu {
                    choices(current: status)
                } label: {
                    icon(status)
                }
            }
        }
        .menuStyle(.button)
        .buttonStyle(.borderless)
        .menuIndicator(.hidden)
        .sensoryFeedback(.success, trigger: logged)
        .sensoryFeedback(.selection, trigger: changed)
        .accessibilityLabel(accessibilityLabel(status))
        .accessibilityHint(status == nil ? Text(L("Logs it as prayed on time. Hold for other choices.")) : Text(L("Changes or clears the entry")))
        .accessibilityActions {
            ForEach(PrayerStatus.menuOrder, id: \.self) { choice in
                Button { set(choice) } label: { Text(choice.title) }
            }
            if status != nil {
                Button { set(nil) } label: { Text(L("Clear entry")) }
            }
        }
    }

    private func icon(_ status: PrayerStatus?) -> some View {
        Image(systemName: status?.symbol ?? "circle")
            .font(.title2)
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(status?.tint ?? Color.secondary)
            .contentTransition(.symbolEffect(.replace))
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(.rect)
    }

    @ViewBuilder
    private func choices(current: PrayerStatus?) -> some View {
        Section {
            ForEach(PrayerStatus.menuOrder, id: \.self) { choice in
                Button {
                    set(choice)
                } label: {
                    Label {
                        Text(choice.title)
                        Text(choice.hint)
                    } icon: {
                        Image(systemName: current == choice ? "checkmark" : choice.symbol)
                    }
                }
            }
        }
        if current != nil {
            Section {
                Button(role: .destructive) {
                    set(nil)
                } label: {
                    Label { Text(L("Clear entry")) } icon: { Image(systemName: "trash") }
                }
            }
        }
    }

    private func accessibilityLabel(_ status: PrayerStatus?) -> Text {
        let name = format.string(prayer.title)
        if let status {
            return Text(verbatim: "\(name): \(format.string(status.title))")
        }
        return Text(L("\(name): not logged"))
    }

    private func set(_ choice: PrayerStatus?) {
        let wasLogged = status != nil
        onChange()
        Task {
            do {
                let result: ChangeResult
                if let choice, choice == .ontime, !wasLogged {
                    result = try await app.records.logPrayer(prayer, on: day)
                } else {
                    result = try await app.records.setPrayer(prayer, choice, on: day)
                }
                guard result == .changed else { return }
                if wasLogged || choice == nil { changed += 1 } else { logged += 1 }
            } catch {
                print("Today: logging \(prayer) on \(day) failed: \(error)")
            }
        }
    }
}
