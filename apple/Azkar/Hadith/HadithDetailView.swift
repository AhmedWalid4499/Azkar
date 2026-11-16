import AzkarKit
import SwiftUI

/// One hadith in full: the Arabic as the source gives it, its source note, where it is in the book,
/// with sharing and keeping it as a favourite.
struct HadithDetailView: View {
    let hadith: Hadith
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var library = HadithLibrary.shared
    @State private var favouriteChanges = 0

    var body: some View {
        let settings = app.settings.settings
        let book = library.collection?.book(hadith.book)
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(H("Riyad as-Salihin \(hadith.number.hadithNumber(locale))"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                    if let book {
                        Text(verbatim: book.title)
                            .font(.custom(RecitationFont.regular, size: 20, relativeTo: .title3))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .environment(\.layoutDirection, .rightToLeft)
                    }
                    Text(HadithBook.position(book: hadith.book, inBook: hadith.inBook))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)

                RecitationView(text: hadith.text, scale: settings.reader.arabicScale)
                    .textSelection(.enabled)

                if let source = hadith.source {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(H("Source"))
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(verbatim: source)
                            .font(.custom(RecitationFont.regular, size: 19, relativeTo: .body))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .environment(\.layoutDirection, .rightToLeft)
                    }
                    .accessibilityElement(children: .combine)
                }

                Text(H("From Riyad as-Salihin by Imam an-Nawawi. The Arabic is shown as the source gives it."))
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            }
            .padding()
        }
        .navigationTitle(Text(H("Hadith \(hadith.number.hadithNumber(locale))")))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                let favourite = settings.app.hadithFavourites.contains(hadith.number)
                Button {
                    toggleFavourite()
                } label: {
                    Label {
                        Text(favourite ? H("Remove from favourites") : H("Add to favourites"))
                    } icon: {
                        Image(systemName: favourite ? "star.fill" : "star")
                    }
                }
                .sensoryFeedback(.selection, trigger: favouriteChanges)
                ShareLink(item: hadith.shareText(locale: locale)) {
                    Label { Text(H("Share")) } icon: { Image(systemName: "square.and.arrow.up") }
                }
            }
        }
        .task { await library.load() }
        #if DEBUG
        .task {
            guard UserDefaults.standard.bool(forKey: "HadithFavourite"), !Self.debugStarred else { return }
            Self.debugStarred = true
            try? await Task.sleep(for: .seconds(1))
            toggleFavourite()
        }
        #endif
    }

    private func toggleFavourite() {
        let favourite = app.settings.settings.app.hadithFavourites.contains(hadith.number)
        app.settings.update { $0.app = $0.app.withHadithFavourite(hadith.number, !favourite) }
        favouriteChanges += 1
    }

    #if DEBUG
    @MainActor private static var debugStarred = false
    #endif
}
