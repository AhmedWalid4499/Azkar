import AzkarKit
import SwiftUI

/// The prayers owed from before the log began: what is left of each, a way to take one off, and
/// the last one taken off to take back. Prayers logged as missed have their own list above.
struct TrackerPrayerBacklogSection: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @State private var editing = false
    @State private var saved = 0

    var body: some View {
        let backlog = data.prayerBacklog
        Section {
            if backlog.isSet {
                ForEach(Prayer.allCases) { prayer in
                    row(prayer, left: backlog.remaining(prayer))
                }
                if let last = data.records.makeups.last {
                    LabeledContent {
                        Button {
                            Task { try? await app.records.undoMakeup(last.id) }
                        } label: {
                            Text("Undo", tableName: "Tracker")
                        }
                        .buttonStyle(.borderless)
                    } label: {
                        Text("Last made up: \(format.string(last.prayer.trackerName)), \(format.shortDay(last.day))", tableName: "Tracker")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Button {
                editing = true
            } label: {
                Label {
                    if backlog.isSet {
                        Text("Change what you owed", tableName: "Tracker")
                    } else {
                        Text("Add prayers you owe", tableName: "Tracker")
                    }
                } icon: {
                    Image(systemName: backlog.isSet ? "pencil.circle.fill" : "plus.circle.fill")
                }
            }
            .sheet(isPresented: $editing) {
                TrackerOwedPrayersSheet(owed: backlog.owedBefore)
            }
            .sensoryFeedback(.success, trigger: saved)
            #if DEBUG
            .task {
                guard TrackerShowcase.opens("owed") else { return }
                try? await Task.sleep(for: .seconds(1.5))
                editing = true
            }
            #endif
        } header: {
            Text("From before you began logging", tableName: "Tracker")
        } footer: {
            if backlog.isSet {
                Text("Made up so far: \(backlog.madeUpCount). Tap + each time you make one up.", tableName: "Tracker")
            } else {
                Text("If you owe prayers from before you used this app, set how many here and take them off as you make them up.", tableName: "Tracker")
            }
        }
    }

    private func row(_ prayer: Prayer, left: Int) -> some View {
        let name = format.string(prayer.trackerName)
        return LabeledContent {
            HStack(spacing: 14) {
                Text(format.number(left))
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(left > 0 ? Color.primary : Color.secondary)
                    .contentTransition(.numericText(value: Double(left)))
                Button {
                    Task {
                        try? await app.records.logMakeup(prayer, on: data.today)
                        saved += 1
                    }
                } label: {
                    Image(systemName: "plus.circle.fill").font(.title2)
                }
                .buttonStyle(.borderless)
                .disabled(left == 0)
                .accessibilityLabel(Text("Made up one \(name)", tableName: "Tracker"))
            }
        } label: {
            Text(verbatim: name)
        }
    }
}

/// How many of each prayer were owed when the user started. Years fill in all five at once, since
/// that is how most people can count them.
struct TrackerOwedPrayersSheet: View {
    @State var owed: [Prayer: Int]
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @Environment(\.dismiss) private var dismiss
    @State private var years = 1

    /// Days in a Hijri year, rounded down.
    private static let daysInYear = 354

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper(value: $years, in: 1...100) {
                        LabeledContent {
                            Text(format.number(years)).monospacedDigit()
                        } label: {
                            Text("Years", tableName: "Tracker")
                        }
                    }
                    Button {
                        for prayer in Prayer.allCases { owed[prayer] = years * Self.daysInYear }
                    } label: {
                        Text("Fill in all five", tableName: "Tracker")
                    }
                } header: {
                    Text("Count by years", tableName: "Tracker")
                } footer: {
                    Text("Each Hijri year counts as \(format.number(Self.daysInYear)) of each prayer. Adjust any of them below.", tableName: "Tracker")
                }

                Section {
                    ForEach(Prayer.allCases) { prayer in
                        LabeledContent {
                            TextField(value: count(prayer), format: .number.grouping(.never).locale(format.locale)) {
                                Text(verbatim: format.number(0))
                            }
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                        } label: {
                            format.text(prayer.trackerName)
                        }
                    }
                } header: {
                    Text("Owed", tableName: "Tracker")
                } footer: {
                    Text("Prayers you log as missed here in the app are counted separately.", tableName: "Tracker")
                }
            }
            .navigationTitle(Text("Prayers you owe", tableName: "Tracker"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetButton(.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    SheetButton(.confirm) {
                        Task {
                            try? await app.records.setOwedPrayersBefore(owed)
                            dismiss()
                        }
                    }
                }
            }
        }
        .appDirection()
        .presentationDetents([.large])
    }

    private func count(_ prayer: Prayer) -> Binding<Int> {
        Binding(get: { owed[prayer] ?? 0 }, set: { owed[prayer] = max(0, $0) })
    }
}
