import AzkarKit
import SwiftUI

/// A verse or a dua the companion showed, in the app's own text, never retyped.
struct CompanionCardView: View {
    let card: CompanionCard
    @Environment(\.locale) private var locale

    private var isArabic: Bool { locale.language.languageCode == .arabic }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch card {
            case let .quran(sura, from, to, ayat):
                header(icon: "book.pages.fill", tint: .teal, title: quranTitle(sura: sura, from: from, to: to))
                arabic(ayat.map { "\($0.text) \u{FD3F}\(arabicNumber($0.number))\u{FD3E}" }.joined(separator: " "), font: QuranTypeset.textFont)
            case let .dua(dua, topic):
                header(icon: "hands.sparkles.fill", tint: .indigo, title: isArabic ? topic.titleAr : topic.titleEn)
                arabic(dua.text, font: RecitationFont.regular)
                if dua.count > 1 {
                    Text(CL("Say it \(dua.count) times"))
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                if !dua.reference.isEmpty {
                    Text(verbatim: dua.reference)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .multilineTextAlignment(.trailing)
                        .environment(\.layoutDirection, .leftToRight)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: .rect(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.separator))
        .accessibilityElement(children: .combine)
    }

    private func header(icon: String, tint: Color, title: String) -> some View {
        Label { Text(verbatim: title).font(.subheadline.weight(.semibold)) } icon: { Image(systemName: icon).foregroundStyle(tint) }
    }

    /// Arabic text, right-aligned whatever the interface's direction.
    private func arabic(_ text: String, font: String) -> some View {
        Text(verbatim: text)
            .font(.custom(font, size: 24, relativeTo: .title3))
            .lineSpacing(8)
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .environment(\.layoutDirection, .leftToRight)
            .textSelection(.enabled)
    }

    private func quranTitle(sura: Int, from: Int, to: Int) -> String {
        let index = QuranPageIndex.bundled
        let name = isArabic ? index.suraName(number: sura) : "Surah \(index.suraTransliteration(number: sura))"
        let number = { (value: Int) in value.formatted(.number.grouping(.never).locale(locale)) }
        var resource = from == to ? CL("\(name), verse \(number(from))") : CL("\(name), verses \("\(number(from))–\(number(to))")")
        resource.locale = locale
        return String(localized: resource)
    }

    private func arabicNumber(_ number: Int) -> String {
        String(String(number).unicodeScalars.map { Character(Unicode.Scalar($0.value - 0x30 + 0x660)!) })
    }
}
