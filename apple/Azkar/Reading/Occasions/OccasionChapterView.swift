import AzkarKit
import SwiftUI

/// One chapter of the duas for occasions, every entry on one page: the Arabic, the reading aids
/// the reader settings ask for, the reference, and for words to say a "Said it" button that logs
/// each time it is said (permanently, with the tasbih counter's records). Guidance has no button.
struct OccasionChapterView: View {
    let chapter: OccasionsBook.Chapter
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale
    @State private var counter: KeyedCounter?
    private let book = OccasionsBook.bundled

    var body: some View {
        let settings = context.reader
        let day = ReadingClock(now: .now, settings: context.settings.settings).tasbihDay
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                Text(verbatim: locale.isArabic ? chapter.title.ar : chapter.title.en)
                    .font(.title3.weight(.semibold))
                    .accessibilityAddTraits(.isHeader)
                    .padding(.horizontal, 4)
                ForEach(book.entries(of: chapter)) { dhikr in
                    OccasionEntryCard(dhikr: dhikr, settings: settings, day: day, counter: counter)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.impact(weight: .light), trigger: counter?.ticks ?? 0) { _, _ in settings.haptics }
        .onAppear { if counter == nil { counter = KeyedCounter(records: context.records) } }
    }
}

private struct OccasionEntryCard: View {
    let dhikr: Dhikr
    let settings: ReaderSettings
    let day: DayKey
    let counter: KeyedCounter?
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let recited = OccasionsBook.isRecited(dhikr)
        let showsTransliteration = ReaderSettings.resolve(settings.showTransliteration, languageCode: locale.languageCode)
        let showsTranslation = ReaderSettings.resolve(settings.showTranslation, languageCode: locale.languageCode)
        let reference = dhikr.reference.prose(for: locale.display)

        VStack(alignment: .leading, spacing: 14) {
            if !recited {
                Label { Text("What to do", tableName: "Reading") } icon: { Image(systemName: "info.circle") }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
            }
            RecitationView(text: dhikr.arabic, scale: recited ? settings.arabicScale : max(1, settings.arabicScale - 1))
                .textSelection(.enabled)
            if showsTransliteration, let transliteration = dhikr.transliteration, !transliteration.isEmpty {
                Text(verbatim: transliteration)
                    .font(.body.italic())
                    .foregroundStyle(.secondary)
                    .environment(\.layoutDirection, .leftToRight)
                    .textSelection(.enabled)
            }
            if showsTranslation || (!recited && !locale.isArabic) {
                Text(verbatim: dhikr.translation)
                    .font(.body)
                    .environment(\.layoutDirection, .leftToRight)
                    .textSelection(.enabled)
            }
            if !reference.isEmpty {
                Text(verbatim: reference)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if recited, dhikr.repeat > 1 {
                Label {
                    Text("Say it \(locale.number(dhikr.repeat)) times", tableName: "Reading")
                } icon: {
                    Image(systemName: "repeat")
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.accentColor)
            }
            if recited, let counter {
                SaidItBar(dhikr: dhikr, day: day, counter: counter)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
    }
}

/// "Said it" with today's count, and taking the last one back.
private struct SaidItBar: View {
    let dhikr: Dhikr
    let day: DayKey
    let counter: KeyedCounter
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let today = counter.count(dhikr.id, on: day)
        HStack(spacing: 12) {
            Button {
                counter.add(dhikr.id, on: day)
            } label: {
                Label {
                    Text("Said it", tableName: "Reading")
                } icon: {
                    Image(systemName: today > 0 ? "checkmark.circle.fill" : "checkmark.circle")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(today > 0 ? .green : .accentColor)
            .controlSize(.large)

            if today > 0 {
                Text(verbatim: "×\(locale.number(today))")
                    .font(.headline)
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(today)))
                    .accessibilityLabel(Text("Said today: \(locale.number(today))", tableName: "Reading"))
                Button {
                    counter.undo(dhikr.id, on: day)
                } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .accessibilityLabel(Text("Undo", tableName: "Reading"))
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
        }
        .animation(.snappy, value: today)
    }
}
