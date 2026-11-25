import AzkarKit
import SwiftUI

/// What a Qur'an search found: surahs by name or number, an ayah by reference, then every ayah
/// holding what was typed, by surah, with the words highlighted. An ayah opens the mushaf at its
/// page; its menu also opens its tafsir.
struct QuranSearchResultsView: View {
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let query: String
    let results: QuranSearchResults
    let open: (Int) -> Void
    let tafsir: (QuranSearchHit) -> Void

    var body: some View {
        List {
            if results.isEmpty {
                ContentUnavailableView.search(text: query)
                    .listRowBackground(Color.clear)
            }
            if !results.suras.isEmpty {
                Section {
                    ForEach(results.suras) { sura in
                        QuranSuraRow(sura: sura) { open(sura.page) }
                    }
                } header: {
                    Text(QL("Surahs"))
                }
            }
            if let reference = results.reference {
                Section {
                    hitRow(reference)
                }
            }
            if !results.hits.isEmpty {
                Section {
                    EmptyView()
                } header: {
                    Text(QL("Found \(results.occurrences) times in \(results.hits.count) ayat"))
                        .monospacedDigit()
                }
                ForEach(results.hitsBySura, id: \.sura) { group in
                    Section {
                        ForEach(group.hits) { hitRow($0) }
                    } header: {
                        suraHeader(group.sura, count: group.hits.map(\.occurrences).reduce(0, +))
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .scrollDismissesKeyboard(.immediately)
    }

    private func suraHeader(_ number: Int, count: Int) -> some View {
        let sura = mushaf.suras[number - 1]
        return HStack(spacing: 6) {
            Text(verbatim: sura.name)
                .font(.custom(RecitationFont.regular, size: 17, relativeTo: .footnote))
            if !format.isArabic {
                Text(verbatim: sura.transliteration)
            }
            Spacer(minLength: 4)
            Text(QL("\(count) times"))
                .monospacedDigit()
        }
    }

    private func hitRow(_ hit: QuranSearchHit) -> some View {
        Button {
            open(hit.page)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(AttributedString(searchSegments: hit.segments))
                    .font(.custom(QuranTypeset.textFont, size: 21, relativeTo: .body))
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .environment(\.layoutDirection, .rightToLeft)
                Text(QL("\(format.isArabic ? mushaf.suras[hit.sura - 1].name : mushaf.suras[hit.sura - 1].transliteration) \(format.number(hit.sura)):\(format.number(hit.ayah)) · page \(hit.page)"))
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 2)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                open(hit.page)
            } label: {
                Label { Text(QL("Open in the mushaf")) } icon: { Image(systemName: "book.pages") }
            }
            Button {
                tafsir(hit)
            } label: {
                Label { Text(QL("Tafsir")) } icon: { Image(systemName: "text.book.closed") }
            }
        }
        .swipeActions(edge: .trailing) {
            Button {
                tafsir(hit)
            } label: {
                Label { Text(QL("Tafsir")) } icon: { Image(systemName: "text.book.closed") }
            }
            .tint(.indigo)
        }
    }
}
