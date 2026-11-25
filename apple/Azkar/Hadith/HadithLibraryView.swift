import AzkarKit
import SwiftUI

/// Riyad as-Salihin in the Azkar tab: the favourites, the twenty books, and a search by word
/// (with or without vowel marks) or by number.
struct HadithLibraryView: View {
    @Environment(AppEnvironment.self) private var app
    @State private var library = HadithLibrary.shared
    @State private var query = ""
    @State private var results: [Hadith]?

    var body: some View {
        Group {
            if let collection = library.collection {
                List {
                    if let results {
                        searchResults(results)
                    } else {
                        content(collection)
                    }
                }
                .listSectionSpacing(.compact)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(Text(H("Riyad as-Salihin")))
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: Text(H("Words or a number")))
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
        .task { await library.load() }
        #if DEBUG
        .task {
            if let typed = UserDefaults.standard.string(forKey: "HadithSearch"), query.isEmpty { query = typed }
        }
        #endif
        // A short pause after typing, then the search runs away from the main actor.
        .task(id: query) {
            let typed = query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !typed.isEmpty else {
                results = nil
                return
            }
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            let collection = await library.load()
            let found = await Task.detached(priority: .userInitiated) { collection.search(typed) }.value
            if !Task.isCancelled { results = found }
        }
    }

    @ViewBuilder
    private func content(_ collection: HadithCollection) -> some View {
        let favourites = app.settings.settings.app.hadithFavourites.compactMap(collection.hadith(number:))
        if !favourites.isEmpty {
            Section {
                ForEach(favourites) { HadithRow(hadith: $0) }
            } header: {
                Text(H("Favourites"))
            }
        }
        Section {
            ForEach(collection.books) { book in
                NavigationLink(value: ReadingDestination.hadithBook(book.number)) {
                    HadithBookRow(book: book)
                }
            }
        } header: {
            Text(H("Books"))
        } footer: {
            Text(H("By Imam an-Nawawi. \(collection.hadith.count) hadith, numbered as on sunnah.com. The Arabic is shown as the source gives it, some with vowel marks and some without."))
        }
    }

    @ViewBuilder
    private func searchResults(_ results: [Hadith]) -> some View {
        if results.isEmpty {
            ContentUnavailableView.search(text: query)
                .listRowBackground(Color.clear)
        } else {
            Section {
                ForEach(results) { HadithRow(hadith: $0) }
            } header: {
                Text(H("\(results.count) found"))
            }
        }
    }
}

/// A book: its number, Arabic title, English name in English, and how many hadith it holds.
private struct HadithBookRow: View {
    let book: HadithBook
    @Environment(\.locale) private var locale

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(book.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(verbatim: book.title)
                    .font(.custom(RecitationFont.regular, size: 19, relativeTo: .body))
                    .lineLimit(2)
                if locale.language.languageCode?.identifier != "ar" {
                    Text(verbatim: book.english)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            Text(book.count, format: .number)
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A hadith in a list: its number and the start of its text; opens it in full.
struct HadithRow: View {
    let hadith: Hadith
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    var body: some View {
        NavigationLink(value: ReadingDestination.hadith(hadith.number)) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(H("No. \(hadith.number.hadithNumber(locale))"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if app.settings.settings.app.hadithFavourites.contains(hadith.number) {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                            .accessibilityLabel(Text(H("Favourite")))
                    }
                }
                Text(verbatim: hadith.text)
                    .font(.custom(RecitationFont.regular, size: 18, relativeTo: .body))
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .environment(\.layoutDirection, .rightToLeft)
            }
            .padding(.vertical, 2)
        }
        .accessibilityElement(children: .combine)
    }
}

/// One book's hadith in order.
struct HadithBookView: View {
    let number: Int
    @State private var library = HadithLibrary.shared

    var body: some View {
        let collection = library.collection
        let book = collection?.book(number)
        List {
            if let collection, let book {
                Section {
                    Text(verbatim: book.title)
                        .font(.custom(RecitationFont.regular, size: 22, relativeTo: .title2))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .environment(\.layoutDirection, .rightToLeft)
                        .accessibilityAddTraits(.isHeader)
                }
                Section {
                    ForEach(collection.hadith(inBook: number)) { HadithRow(hadith: $0) }
                }
            }
        }
        .listSectionSpacing(.compact)
        .navigationTitle(Text(book?.label ?? H("Riyad as-Salihin")))
        .navigationBarTitleDisplayMode(.inline)
        .task { await library.load() }
    }
}

/// A hadith opened from a list, by number.
struct HadithNumberView: View {
    let number: Int
    @State private var library = HadithLibrary.shared

    var body: some View {
        if let hadith = library.collection?.hadith(number: number) {
            HadithDetailView(hadith: hadith)
        } else {
            ProgressView().task { await library.load() }
        }
    }
}
