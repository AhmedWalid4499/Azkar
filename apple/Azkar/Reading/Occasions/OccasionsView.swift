import AzkarKit
import SwiftUI

/// The duas for every occasion: the book's other chapters by theme, searchable in Arabic (with or
/// without vowel marks), English or transliteration.
struct OccasionsView: View {
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale
    @State private var query = ""
    private let book = OccasionsBook.bundled

    var body: some View {
        let day = ReadingClock(now: .now, settings: context.settings.settings).tasbihDay
        List {
            if query.trimmingCharacters(in: .whitespaces).isEmpty {
                ForEach(book.themes) { theme in
                    Section {
                        ForEach(book.chapters(in: theme)) { chapter in
                            OccasionChapterRow(chapter: chapter, day: day)
                        }
                    } header: {
                        Text(LocalizedStringKey(theme.title), tableName: "Reading")
                    }
                }
            } else {
                let found = book.search(query)
                if found.isEmpty {
                    ContentUnavailableView.search(text: query)
                        .listRowBackground(Color.clear)
                } else {
                    ForEach(found) { chapter in
                        OccasionChapterRow(chapter: chapter, day: day)
                    }
                }
            }
        }
        .listSectionSpacing(.compact)
        .searchable(text: $query, prompt: Text("Search the duas", tableName: "Reading"))
        .navigationTitle(Text("Duas for every occasion", tableName: "Reading"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One chapter in the list: its title, and how many of its duas were said today.
struct OccasionChapterRow: View {
    let chapter: OccasionsBook.Chapter
    let day: DayKey
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let records = context.day(day).tasbih
        let said = chapter.items.reduce(0) { $0 + (records[$1]?.count ?? 0) }
        NavigationLink(value: ReadingDestination.occasion(chapter.number)) {
            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: locale.isArabic ? chapter.title.ar : chapter.title.en)
                    .font(.body)
                    .lineLimit(3)
                if said > 0 {
                    Label {
                        Text("Said today: \(locale.number(said))", tableName: "Reading")
                    } icon: {
                        Image(systemName: "checkmark.circle.fill")
                    }
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(.green)
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The picker's way into the duas for occasions.
struct OccasionsRow: View {
    let day: DayKey
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let today = OccasionStats.count(of: context.day(day).tasbihRecords)
        NavigationLink(value: ReadingDestination.occasions) {
            HStack(spacing: 14) {
                ReadingProgressBadge(fraction: 0, systemImage: "hands.and.sparkles", tint: .teal)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Duas for every occasion", tableName: "Reading")
                        .font(.headline)
                    Text("Leaving home, travel, rain, worry, illness and more, from Hisn al-Muslim", tableName: "Reading")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if today > 0 {
                        Text("Said today: \(locale.number(today))", tableName: "Reading")
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .accessibilityElement(children: .combine)
    }
}
