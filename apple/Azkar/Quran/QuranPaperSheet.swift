import AzkarKit
import SwiftUI

/// Reading done away from the app: the page reached in a paper mushaf, or a whole khatmah.
struct QuranPaperSheet: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    let mushaf: QuranMushaf
    @State private var pageText = ""
    @State private var check: QuranLogCheck?
    @State private var confirmsKhatmah = false
    @FocusState private var editing: Bool

    private var page: Int? { Int(pageText).flatMap { QuranMushaf.pages.contains($0) ? $0 : nil } }
    private var day: DayKey { DayKey(.now, in: app.settings.settings.timeZone) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $pageText) { Text(QL("Page 1 to 604")) }
                        .keyboardType(.numberPad)
                        .focused($editing)
                        .monospacedDigit()
                } header: {
                    Text(QL("I reached page"))
                } footer: {
                    if let page {
                        Text(verbatim: mushaf.sura(ofPage: page).name)
                            .font(.custom(RecitationFont.regular, size: 17, relativeTo: .footnote))
                    } else {
                        Text(QL("Page numbers follow the Medina Mushaf."))
                    }
                }
                Section {
                    Button {
                        confirmsKhatmah = true
                    } label: {
                        Label { Text(QL("Add a finished khatmah")) } icon: { Image(systemName: "checkmark.seal") }
                    }
                }
            }
            .navigationTitle(Text(QL("I read from a paper mushaf")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        confirm()
                    } label: {
                        Text(QL("Save"))
                    }
                    .disabled(page == nil)
                }
            }
            .confirmationDialog(checkTitle, isPresented: Binding(get: { check != nil }, set: { if !$0 { check = nil } }), titleVisibility: .visible) {
                Button { save() } label: { Text(QL("Save")) }
            }
            .confirmationDialog(Text(QL("Add this khatmah?")), isPresented: $confirmsKhatmah, titleVisibility: .visible) {
                Button { addKhatmah() } label: { Text(QL("Add")) }
            }
        }
        .presentationDetents([.medium])
        .onAppear { editing = true }
    }

    private var checkTitle: Text {
        switch check {
        case let .movesBack(from): Text(QL("You had reached page \(from). Move back to page \(page ?? 0)?"))
        case let .manyPages(pages): Text(QL("That counts \(pages) pages as read. Save?"))
        case .nothing, .save, nil: Text(verbatim: "")
        }
    }

    private func confirm() {
        guard let page else { return }
        let result = QuranLogCheck(page: page, progress: QuranProgress(entries: app.records.records.quran))
        switch result {
        case .nothing: dismiss()
        case .save: save()
        case .movesBack, .manyPages: check = result
        }
    }

    private func save() {
        guard let page else { return }
        Task {
            do {
                try await app.records.logQuranReading(toPage: page, on: day, at: .now)
                dismiss()
            } catch {
                print("Quran: saving the page failed: \(error)")
            }
        }
    }

    private func addKhatmah() {
        Task {
            do {
                try await app.records.logKhatmah(on: day, at: .now)
                dismiss()
            } catch {
                print("Quran: adding the khatmah failed: \(error)")
            }
        }
    }
}
