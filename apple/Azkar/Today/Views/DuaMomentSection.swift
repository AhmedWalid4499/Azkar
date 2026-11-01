import AzkarKit
import SwiftUI

/// The user's duas, brought forward at the times for them. Absent the rest of the time, and for
/// anyone without a dua on their list.
struct DuaMomentSection: View {
    @Environment(AppEnvironment.self) private var app
    let context: TodayContext
    @State private var showing = false

    var body: some View {
        let records = app.records.records
        let open = DuaProgress(items: records.duas, entries: records.duaEntries).open
        let times = context.todayTimes?.times
        if !open.isEmpty, let moment = DuaMoments.current(now: context.now, today: context.today, beforeDawn: context.beforeDawn,
                                                          asr: times?[.asr], maghrib: times?[.maghrib], offset: app.settings.settings.app.hijriOffset) {
            Section {
                Button {
                    showing = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "hands.sparkles.fill")
                            .font(.title2)
                            .foregroundStyle(.indigo)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title(moment))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(L("A time to make your duas"))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.forward")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .sheet(isPresented: $showing) {
                    DuaMomentSheet(title: title(moment), rows: open, day: context.today)
                }
            }
        }
    }

    private func title(_ moment: DuaMoment) -> LocalizedStringResource {
        switch moment {
        case .arafah: L("The day of Arafah")
        case let .lastTenNight(night): L("Night \(night) of Ramadan")
        case .fridayHour: L("The last hours of Friday")
        }
    }
}

/// The list, to read through and mark as made.
private struct DuaMomentSheet: View {
    let title: LocalizedStringResource
    let rows: [DuaProgress.Row]
    let day: DayKey
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var saved = 0

    var body: some View {
        NavigationStack {
            List(rows) { row in
                Text(verbatim: row.item.text)
                    .textSelection(.enabled)
                    .padding(.vertical, 4)
            }
            .navigationTitle(Text(title))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    Task {
                        try? await app.records.logDuasSaid(rows.map(\.id), on: day)
                        saved += 1
                        dismiss()
                    }
                } label: {
                    Text(L("I made these duas")).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding()
            }
            .sensoryFeedback(.success, trigger: saved)
        }
        .appDirection()
    }
}
