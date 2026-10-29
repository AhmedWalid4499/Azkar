import AzkarKit
import SwiftUI

/// Logs a make-up fast on a day that has begun, and keeps the count of days owed from before
/// the log began.
struct TrackerQadaFastSheet: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date.now
    @State private var status = FastStatus.fasted
    @State private var owedBefore: Int?
    @State private var saved = 0

    var body: some View {
        let day = DayKey(date, in: data.clock.timeZone)
        let existing = data.day(day).fast
        let owed = owedBefore ?? data.records.owedFastsBefore
        NavigationStack {
            Form {
                Section {
                    DatePicker(selection: $date, in: ...data.clock.now, displayedComponents: .date) {
                        Text("Day", tableName: "Tracker")
                    }
                    Picker(selection: $status) {
                        ForEach([FastStatus.fasted, .broken], id: \.self) { status in
                            Label { format.text(status.trackerName) } icon: { Image(systemName: status.trackerSymbol) }.tag(status)
                        }
                    } label: {
                        Text("How it went", tableName: "Tracker")
                    }
                } header: {
                    Text("Make-up fast", tableName: "Tracker")
                } footer: {
                    if let existing, existing.kind != .qada {
                        Text("This replaces the \(format.string(existing.kind.trackerName)) fast logged on that day.", tableName: "Tracker")
                    } else {
                        Text(format.hijri(day))
                    }
                }

                Section {
                    Stepper(value: Binding(get: { owed }, set: { owedBefore = $0 }), in: 0...RecordLimits.maxOwedFastsBefore) {
                        LabeledContent {
                            Text(format.number(owed)).monospacedDigit()
                        } label: {
                            Text("Days owed from before you began logging", tableName: "Tracker")
                        }
                    }
                } footer: {
                    Text("Days of Ramadan you still owed when you started using the tracker. Days logged here since are counted for you.", tableName: "Tracker")
                }
            }
            .navigationTitle(Text("Log a make-up fast", tableName: "Tracker"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save(day) }
                }
            }
            .sensoryFeedback(.success, trigger: saved)
        }
        .presentationDetents([.medium, .large])
    }

    private func save(_ day: DayKey) {
        Task {
            _ = try? await app.records.setFast(.qada, status, on: day)
            if let owedBefore, owedBefore != data.records.owedFastsBefore {
                _ = try? await app.records.setOwedFastsBefore(owedBefore)
            }
            saved += 1
            dismiss()
        }
    }
}
