import AzkarKit
import SwiftUI

/// The mushaf: 604 pages that turn right to left whatever the interface language, with a thin
/// strip above and below them. "Stopped here" is the only thing that records reading: scrolling
/// past a page does not mean it was read.
struct QuranReaderView: View {
    static let lastPageKey = "quran.lastPage"

    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage(Self.lastPageKey) private var lastPage = 0
    let mushaf: QuranMushaf
    @State private var page: Int?
    @State private var check: QuranLogCheck?
    @State private var checkedPage = 0
    @State private var saved: QuranSavedNote?
    @State private var finished: Int?

    init(mushaf: QuranMushaf, startPage: Int) {
        self.mushaf = mushaf
        _page = State(initialValue: startPage)
    }

    var body: some View {
        let shown = page ?? 1
        let records = app.records.records
        let progress = QuranProgress(entries: records.quran)
        let day = DayKey(.now, in: app.settings.settings.timeZone)
        VStack(spacing: 0) {
            header(shown, bookmarked: records.quranBookmarks[shown] != nil)
            pager
                .overlay(alignment: .bottom) {
                    if let saved {
                        note(saved, pagesToday: progress.pages(on: day))
                            .padding(.bottom, 8)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
            footer(shown, progress: progress)
        }
        .background(Color.quranPaper.ignoresSafeArea())
        .keepsScreenAwake(app.settings.settings.reader.keepAwake)
        .onAppear { setPortraitOnly(true) }
        .onDisappear { setPortraitOnly(false) }
        .sensoryFeedback(.success, trigger: saved?.id)
        .sensoryFeedback(.selection, trigger: records.quranBookmarks[shown] != nil)
        .task(id: shown) {
            lastPage = shown
            await QuranLayouts.shared.prepare(around: shown)
        }
        .task(id: saved?.id) {
            guard saved != nil else { return }
            try? await Task.sleep(for: .seconds(6))
            if !Task.isCancelled { withAnimation(.snappy) { saved = nil } }
        }
        .confirmationDialog(checkTitle, isPresented: Binding(get: { check != nil }, set: { if !$0 { check = nil } }), titleVisibility: .visible) {
            Button {
                save(checkedPage, day: day)
            } label: {
                Text(QL("Save"))
            }
        }
        .alert(Text(QL("Khatmah complete")), isPresented: Binding(get: { finished != nil }, set: { if !$0 { finished = nil } })) {
            Button(role: .confirm) {} label: { Text(QL("Done")) }
        } message: {
            Text(QL("This is khatmah number \(finished ?? 0). Your place goes back to the beginning."))
        }
    }

    private var pager: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(Array(QuranMushaf.pages), id: \.self) { number in
                    QuranPageCanvas(page: number)
                        .padding(.vertical, 2)
                        .containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $page)
        // A mushaf turns the same way in any language; the strips above and below keep the interface's.
        .environment(\.layoutDirection, .rightToLeft)
    }

    private func header(_ shown: Int, bookmarked: Bool) -> some View {
        HStack(spacing: 8) {
            Button(role: .close) {
                dismiss()
            } label: {
                Label { Text(QL("Close")) } icon: { Image(systemName: "xmark") }
                    .labelStyle(.iconOnly)
            }
            .buttonBorderShape(.circle)
            .buttonStyle(.glass)
            Spacer(minLength: 4)
            VStack(spacing: 0) {
                Text(verbatim: mushaf.sura(ofPage: shown).name)
                    .font(.custom(RecitationFont.bold, size: 17, relativeTo: .subheadline))
                Text(QL("Juz \(mushaf.juz(ofPage: shown).number)"))
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Button {
                setBookmark(shown, on: !bookmarked)
            } label: {
                Label {
                    Text(bookmarked ? QL("Remove bookmark") : QL("Bookmark this page"))
                } icon: {
                    Image(systemName: bookmarked ? "bookmark.fill" : "bookmark")
                        .contentTransition(.symbolEffect(.replace))
                }
                .labelStyle(.iconOnly)
            }
            .buttonBorderShape(.circle)
            .buttonStyle(.glass)
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 4)
    }

    private func footer(_ shown: Int, progress: QuranProgress) -> some View {
        let here = progress.position == shown
        return ZStack {
            Text(QL("Page \(shown)"))
                .font(.footnote.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                stop(at: shown)
            } label: {
                Label {
                    Text(here ? QL("You stopped here") : QL("Stopped here"))
                } icon: {
                    Image(systemName: here ? "checkmark" : "bookmark.circle")
                }
                .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.glassProminent)
            .disabled(here)
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func note(_ saved: QuranSavedNote, pagesToday: Int) -> some View {
        HStack(spacing: 12) {
            Text(QL("Saved. \(pagesToday) pages today"))
                .font(.subheadline.weight(.medium))
                .monospacedDigit()
            Button {
                undo(saved)
            } label: {
                Text(QL("Undo")).font(.subheadline.weight(.semibold))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .glassEffect()
    }

    private var checkTitle: Text {
        switch check {
        case let .movesBack(from): Text(QL("You had reached page \(from). Move back to page \(checkedPage)?"))
        case let .manyPages(pages): Text(QL("That counts \(pages) pages as read. Save?"))
        case .nothing, .save, nil: Text(verbatim: "")
        }
    }

    private func stop(at shown: Int) {
        let result = QuranLogCheck(page: shown, progress: QuranProgress(entries: app.records.records.quran))
        switch result {
        case .nothing: break
        case .save: save(shown, day: DayKey(.now, in: app.settings.settings.timeZone))
        case .movesBack, .manyPages:
            checkedPage = shown
            check = result
        }
    }

    private func save(_ shown: Int, day: DayKey) {
        Task {
            do {
                let entry = try await app.records.logQuranReading(toPage: shown, on: day, at: .now)
                withAnimation(.snappy) { saved = QuranSavedNote(id: entry.id) }
                if shown == QuranMushaf.pageCount {
                    finished = QuranProgress(entries: app.records.records.quran).khatmahs
                }
            } catch {
                print("Quran: saving the page failed: \(error)")
            }
        }
    }

    private func undo(_ note: QuranSavedNote) {
        withAnimation(.snappy) { saved = nil }
        Task {
            do {
                try await app.records.undoQuranEntry(note.id)
            } catch {
                print("Quran: undoing failed: \(error)")
            }
        }
    }

    /// A page of the mushaf needs the height: on an iPhone it stays upright while open.
    private func setPortraitOnly(_ on: Bool) {
        guard UIDevice.current.userInterfaceIdiom == .phone else { return }
        SystemAppDelegate.portraitOnly = on
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
        scene.keyWindow?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
        if on { scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) }
    }

    private func setBookmark(_ shown: Int, on: Bool) {
        Task {
            do {
                try await app.records.setQuranBookmark(page: shown, on: on, at: .now)
            } catch {
                print("Quran: saving the bookmark failed: \(error)")
            }
        }
    }
}

/// The last place saved, while it can still be undone.
private struct QuranSavedNote: Equatable {
    let id: UUID
}
