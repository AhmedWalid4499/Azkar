import AzkarKit
import SwiftUI

/// The user's own duas: those still being asked for, then those answered. A row opens a menu, as a
/// surah does in the memorised list, and everything done here goes on the log.
struct TrackerDuaSections: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @State private var sheet: DuaSheet?
    @State private var removing: DuaItem?
    @State private var saved = 0

    private enum DuaSheet: Identifiable {
        case add
        case edit(DuaItem)

        var id: UUID? {
            if case let .edit(item) = self { item.id } else { nil }
        }
    }

    var body: some View {
        let progress = data.duas
        Section {
            ForEach(progress.open) { row in
                Menu {
                    Button { log(.said, row) } label: {
                        Label { Text("I made this dua", tableName: "Tracker") } icon: { Image(systemName: "hands.sparkles") }
                    }
                    Button { log(.answered, row) } label: {
                        Label { Text("Mark as answered", tableName: "Tracker") } icon: { Image(systemName: "checkmark.seal") }
                    }
                    Divider()
                    commonActions(row)
                } label: {
                    DuaRowLabel(row: row, line: said(row))
                }
                .buttonStyle(.plain)
            }
            Button {
                sheet = .add
            } label: {
                Label { Text("Add a dua", tableName: "Tracker") } icon: { Image(systemName: "plus.circle.fill") }
            }
            .sheet(item: $sheet) { sheet in
                switch sheet {
                case .add: TrackerDuaSheet(existing: nil)
                case let .edit(item): TrackerDuaSheet(existing: item)
                }
            }
            .alert(Text("Delete this dua?", tableName: "Tracker"), isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })) {
                Button(role: .destructive) {
                    if let removing { Task { try? await app.records.removeDua(removing.id) } }
                } label: {
                    Text("Delete", tableName: "Tracker")
                }
                SheetButton(.cancel) {}
            } message: {
                Text("Its words are removed. The times you made it stay counted.", tableName: "Tracker")
            }
            .sensoryFeedback(.success, trigger: saved)
            #if DEBUG
            .task {
                guard TrackerShowcase.opens("dua") else { return }
                try? await Task.sleep(for: .seconds(1.5))
                sheet = .add
            }
            #endif
        } footer: {
            Text("They come up on Today on the day of Arafah, in the last ten nights of Ramadan and on Fridays between Asr and Maghrib.", tableName: "Tracker")
        }

        if !progress.answered.isEmpty {
            Section {
                ForEach(progress.answered) { row in
                    Menu {
                        if let line = row.answered {
                            Button {
                                Task { try? await app.records.undoDuaEntry(line.id) }
                            } label: {
                                Label { Text("Not answered yet", tableName: "Tracker") } icon: { Image(systemName: "arrow.uturn.backward") }
                            }
                        }
                        Divider()
                        commonActions(row)
                    } label: {
                        DuaRowLabel(row: row, line: Text("Answered \(format.shortDay(row.answered?.day ?? data.today))", tableName: "Tracker"), answered: true)
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text("Answered", tableName: "Tracker")
            }
        }
    }

    @ViewBuilder private func commonActions(_ row: DuaProgress.Row) -> some View {
        Button { sheet = .edit(row.item) } label: {
            Label { Text("Edit", tableName: "Tracker") } icon: { Image(systemName: "pencil") }
        }
        Button(role: .destructive) { removing = row.item } label: {
            Label { Text("Delete", tableName: "Tracker") } icon: { Image(systemName: "trash") }
        }
    }

    private func said(_ row: DuaProgress.Row) -> Text? {
        guard let last = row.lastSaidOn else { return nil }
        return Text("Made: \(row.said), last on \(format.shortDay(last))", tableName: "Tracker")
    }

    private func log(_ kind: DuaEntry.Kind, _ row: DuaProgress.Row) {
        Task {
            try? await app.records.logDua(kind, dua: row.id, on: data.today)
            saved += 1
        }
    }
}

private struct DuaRowLabel: View {
    let row: DuaProgress.Row
    let line: Text?
    var answered = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: answered ? "checkmark.seal.fill" : "hands.sparkles.fill")
                .foregroundStyle(answered ? Color.green : Color.indigo)
            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: row.item.text)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                line?
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .contentShape(.rect)
    }
}

/// Writes a new dua, or rewrites one.
struct TrackerDuaSheet: View {
    let existing: DuaItem?
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var writing: Bool

    var body: some View {
        NavigationStack {
            Form {
                TextField(text: $text, axis: .vertical) {
                    Text("Your dua", tableName: "Tracker")
                }
                .lineLimit(4...14)
                .focused($writing)
            }
            .navigationTitle(existing == nil ? Text("Add a dua", tableName: "Tracker") : Text("Edit", tableName: "Tracker"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetButton(.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    SheetButton(.confirm) { save() }
                        .disabled(DuaItem.cleaned(text) == nil)
                }
            }
        }
        .appDirection()
        .presentationDetents([.medium, .large])
        .onAppear {
            text = existing?.text ?? ""
            writing = true
        }
    }

    private func save() {
        Task {
            if let existing {
                try? await app.records.editDua(existing.id, text: text)
            } else {
                try? await app.records.addDua(text)
            }
            dismiss()
        }
    }
}
