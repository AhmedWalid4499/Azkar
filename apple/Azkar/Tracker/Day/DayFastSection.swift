import AzkarKit
import SwiftUI

/// The day's fast: its kind and how it went, logged, changed or cleared here; with what the
/// calendar says of the day (Ramadan, a day fasting is not permitted, a recommended day).
struct TrackerDayFastSection: View {
    let data: TrackerData
    let day: DayKey
    let fast: FastRecord?
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @State private var changes = 0

    var body: some View {
        let info = FastingCalendar.info(for: day, offset: data.settings.app.hijriOffset)
        Section {
            Picker(selection: Binding(get: { fast?.kind }, set: setKind)) {
                Text("No fast logged", tableName: "Tracker").tag(FastKind?.none)
                ForEach(FastKind.allCases, id: \.self) { kind in
                    format.text(kind.trackerName).tag(FastKind?.some(kind))
                }
            } label: {
                Label { Text("Fast", tableName: "Tracker") } icon: { Image(systemName: TrackerMark.fast).foregroundStyle(.pink) }
            }
            .pickerStyle(.menu)

            if let fast {
                Picker(selection: Binding(get: { fast.status }, set: { setStatus($0, kind: fast.kind) })) {
                    ForEach(FastStatus.allCases, id: \.self) { status in
                        Label { format.text(status.trackerName) } icon: { Image(systemName: status.trackerSymbol) }
                            .tag(status)
                    }
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("How it went", tableName: "Tracker")
                            if let at = fast.loggedAt {
                                Text("Logged \(format.when(at, on: day))", tableName: "Tracker")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } icon: {
                        Image(systemName: fast.status.trackerSymbol).foregroundStyle(fast.status.trackerTint)
                    }
                }
                .pickerStyle(.menu)

                Button(role: .destructive) {
                    changes += 1
                    Task { try? await app.records.clearFast(on: day) }
                } label: {
                    Label { Text("Clear the fast", tableName: "Tracker") } icon: { Image(systemName: "trash") }
                }
            }
        } header: {
            Text("Fasting", tableName: "Tracker")
        } footer: {
            footer(info)
        }
        .sensoryFeedback(.selection, trigger: changes)
    }

    @ViewBuilder private func footer(_ info: FastingDayInfo) -> some View {
        if let forbidden = info.forbidden {
            format.text(forbidden.trackerNotice)
        } else if let ramadanDay = info.ramadanDay {
            Text("Day \(ramadanDay) of Ramadan", tableName: "Tracker")
        } else if !info.reasons.isEmpty {
            Text("Fasting is recommended on this day: \(format.list(info.reasons.map { format.string($0.trackerName) }))", tableName: "Tracker")
        }
    }

    private func setKind(_ kind: FastKind?) {
        changes += 1
        Task {
            if let kind {
                _ = try? await app.records.setFast(kind, fast?.status ?? .fasted, on: day)
            } else {
                _ = try? await app.records.clearFast(on: day)
            }
        }
    }

    private func setStatus(_ status: FastStatus, kind: FastKind) {
        changes += 1
        Task { try? await app.records.setFast(kind, status, on: day) }
    }
}
