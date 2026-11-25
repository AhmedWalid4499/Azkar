import AzkarKit
import SwiftUI

/// The tafsir of a mushaf page: each ayah in the mushaf's script, then al-Mukhtasar's explanation
/// of it. Opens on the page being read, or on one ayah found by a search, and turns page by page.
struct QuranTafsirSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.layoutDirection) private var direction
    let mushaf: QuranMushaf
    @State private var page: Int
    /// The ayah to bring into view when the sheet opens.
    private let focus: AyahRef?
    @State private var tafsir: QuranTafsir?

    init(mushaf: QuranMushaf, page: Int, focus: AyahRef? = nil) {
        self.mushaf = mushaf
        _page = State(initialValue: page)
        self.focus = focus
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    if let tafsir {
                        ForEach(mushaf.ayat(onPage: page), id: \.self) { ayah in
                            QuranTafsirRow(mushaf: mushaf, ayah: ayah, explanation: tafsir.text(for: AyahRef(sura: ayah.sura, ayah: ayah.number)) ?? "",
                                           isFocus: focus == AyahRef(sura: ayah.sura, ayah: ayah.number))
                                .id(AyahRef(sura: ayah.sura, ayah: ayah.number))
                        }
                        Section {
                            EmptyView()
                        } footer: {
                            credit(tafsir)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .listSectionSpacing(.compact)
                .overlay {
                    if tafsir == nil { ProgressView() }
                }
                .task {
                    tafsir = await Task.detached(priority: .userInitiated) { QuranTafsir.mukhtasar }.value
                    if let focus {
                        try? await Task.sleep(for: .milliseconds(50))
                        proxy.scrollTo(focus, anchor: .top)
                    }
                }
                .onChange(of: page) {
                    if let first = mushaf.ayat(onPage: page).first {
                        proxy.scrollTo(AyahRef(sura: first.sura, ayah: first.number), anchor: .top)
                    }
                }
            }
            .navigationTitle(Text(QL("Tafsir")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetButton(.close) { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(QL("Tafsir")).font(.headline)
                        HStack(spacing: 4) {
                            Text(verbatim: mushaf.sura(ofPage: page).name)
                                .font(.custom(RecitationFont.regular, size: 13, relativeTo: .caption2))
                            Text(verbatim: "·")
                            Text(QL("Page \(page)"))
                                .monospacedDigit()
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                }
                ToolbarItemGroup(placement: .bottomBar) {
                    // The mushaf turns right to left: the next page is on the left, whatever the
                    // interface's direction (which would otherwise mirror the order of these items).
                    if direction == .rightToLeft {
                        previousButton
                        Spacer()
                        nextButton
                    } else {
                        nextButton
                        Spacer()
                        previousButton
                    }
                }
            }
            .sensoryFeedback(.selection, trigger: page)
        }
    }

    private var nextButton: some View {
        Button {
            page = min(page + 1, QuranMushaf.pageCount)
        } label: {
            Label { Text(QL("Next page")) } icon: { Image(systemName: "chevron.left") }
        }
        .disabled(page >= QuranMushaf.pageCount)
    }

    private var previousButton: some View {
        Button {
            page = max(page - 1, 1)
        } label: {
            Label { Text(QL("Previous page")) } icon: { Image(systemName: "chevron.right") }
        }
        .disabled(page <= 1)
    }

    private func credit(_ tafsir: QuranTafsir) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(QL("From al-Mukhtasar fi Tafsir al-Qur'an al-Karim, by the Tafsir Center for Qur'anic Studies, as published on QuranEnc.com (taken \(tafsir.retrieved)). Shown unchanged."))
            Link(destination: tafsir.source) {
                Text(verbatim: "QuranEnc.com")
            }
        }
        .font(.footnote)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// One ayah and its explanation.
private struct QuranTafsirRow: View {
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let ayah: QuranAyah
    let explanation: String
    let isFocus: Bool

    var body: some View {
        let ref = AyahRef(sura: ayah.sura, ayah: ayah.number)
        Section {
            VStack(alignment: .leading, spacing: 12) {
                Text(verbatim: "\(mushaf.suras[ayah.sura - 1].name) \(format.number(ayah.sura)):\(format.number(ayah.number))")
                    .font(.custom(RecitationFont.regular, size: 15, relativeTo: .footnote))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .environment(\.layoutDirection, .rightToLeft)
                    .accessibilityLabel(Text(QL("Ayah \(ref.ayah) of surah \(mushaf.suras[ayah.sura - 1].transliteration)")))
                Text(verbatim: QuranTypesetting.displayText(QuranMushaf.splitBasmala(ayah)?.rest ?? ayah.text) + QuranTypesetting.ayahEnd(ayah.number))
                    .font(.custom(QuranTypeset.textFont, size: 22, relativeTo: .title3))
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .environment(\.layoutDirection, .rightToLeft)
                Text(verbatim: explanation)
                    .font(.body)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .environment(\.layoutDirection, .rightToLeft)
            }
            .padding(.vertical, 6)
            .listRowBackground(isFocus ? Color.accentColor.opacity(0.08) : nil)
        }
    }
}
