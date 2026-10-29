import AzkarKit
import SwiftUI

/// The day's azkar sessions (morning, evening, before sleep and after each prayer): how far
/// each got, when it was begun and finished, and the repetitions counted. A session with a
/// record is always listed, even one the app no longer offers.
struct TrackerDayAzkarSection: View {
    let data: TrackerData
    let day: DayKey
    let sessions: [AzkarSession: SessionRecord]

    var body: some View {
        let shown = AzkarSession.all.filter { data.trackedSessions.contains($0) || sessions[$0] != nil }
        Section {
            ForEach(shown, id: \.self) { session in
                TrackerSessionRecordRow(session: session, day: day, record: sessions[session])
            }
        } header: {
            Text("Azkar", tableName: "Tracker")
        }
    }
}

private struct TrackerSessionRecordRow: View {
    let session: AzkarSession
    let day: DayKey
    let record: SessionRecord?
    @Environment(\.trackerFormat) private var format

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: session.trackerSymbol)
                    .foregroundStyle(session.trackerTint)
                    .frame(width: 24)
                format.text(session.trackerName)
                    .font(.body.weight(.medium))
                Spacer(minLength: 8)
                state
            }
            if let record {
                details(record)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var state: some View {
        if record?.completed == true {
            Label { Text("Completed", tableName: "Tracker") } icon: { Image(systemName: "checkmark.circle.fill") }
                .foregroundStyle(.green)
                .font(.subheadline.weight(.medium))
        } else if record != nil {
            Label { Text("In progress", tableName: "Tracker") } icon: { Image(systemName: "circle.lefthalf.filled") }
                .foregroundStyle(.orange)
                .font(.subheadline)
        } else {
            Label { Text("Not read", tableName: "Tracker") } icon: { Image(systemName: "circle.dashed") }
                .foregroundStyle(.secondary)
                .font(.subheadline)
        }
    }

    @ViewBuilder private func details(_ record: SessionRecord) -> some View {
        let total = record.total
        let done = record.completed ? total : record.done
        // After "Start over" a completed session can be read a second time; that reading shows too.
        let again = record.completed && record.done > 0 && record.done < record.total
        if total > 0 {
            ProgressView(value: Double(done), total: Double(total))
                .tint(session.trackerTint)
                .accessibilityHidden(true)
            Group {
                if again {
                    Text("Reading again: \(record.done) of \(total)", tableName: "Tracker")
                } else {
                    Text("\(done) of \(total) done", tableName: "Tracker")
                }
            }
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
        }
        VStack(spacing: 4) {
            if let started = record.startedAt {
                fact(Text("Started", tableName: "Tracker"), Text(format.when(started, on: day)))
            }
            if record.completed {
                fact(Text("Finished", tableName: "Tracker"), record.completedAt.map { Text(format.when($0, on: day)) } ?? Text("Time not recorded", tableName: "Tracker"))
            }
            // Once completed, the last count is news only when it came later.
            if let last = record.lastAt, !record.completed || record.completedAt.map({ last > $0 }) ?? false {
                fact(Text("Last count", tableName: "Tracker"), Text(format.when(last, on: day)))
            }
            if record.recitations > 0 {
                fact(Text("Recitations", tableName: "Tracker"), Text(format.number(record.recitations)))
            }
        }
        .font(.subheadline)
    }

    private func fact(_ name: Text, _ value: Text) -> some View {
        LabeledContent {
            value.monospacedDigit()
        } label: {
            name.foregroundStyle(.secondary)
        }
    }
}
