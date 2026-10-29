import AzkarKit
import SwiftUI

/// The typeface of the azkar text: Amiri (SIL OFL 1.1, apple/Azkar/Fonts), listed in Info.plist.
enum RecitationFont {
    static let regular = "Amiri-Regular"
    static let bold = "Amiri-Bold"

    /// Point sizes of the five Arabic text sizes at the default Dynamic Type size; they grow
    /// with Dynamic Type like `.title2`.
    static let sizes: [CGFloat] = [24, 28, 32, 37, 43]

    static func size(scale: Int) -> CGFloat {
        sizes[min(max(scale, ReaderSettings.arabicScales.lowerBound), ReaderSettings.arabicScales.upperBound) - 1]
    }

    /// How far a Qur'anic pause mark is brought down, in ems. Amiri draws the small high signs
    /// (U+06D6–U+06DC) for the tallest letters, so after a space they float well above the line;
    /// this sets them beside the top of the word they follow, as the website does.
    static let pauseMarkDrop: CGFloat = 0.6
    /// Extra space between lines, in ems, for the harakat above and below.
    static let lineSpacing: CGFloat = 0.5
}

/// A dhikr's Arabic text in Amiri, right to left whatever the interface language, with each
/// Qur'anic pause mark kept on its word's line and set at a readable height, and the sajdah sign
/// kept on its word's line as written (`RecitationText.segments`). The characters shown are the
/// dataset's own; only the space before a pause mark or the sajdah sign is shown as a no-break
/// space so that it cannot wrap away from its word.
struct RecitationView: View {
    let text: String
    /// `ReaderSettings.arabicScale`.
    var scale: Int = ReaderSettings.default.arabicScale
    var alignment: TextAlignment = .leading
    @Environment(\.colorScheme) private var colorScheme
    @ScaledMetric(relativeTo: .title2) private var dynamicTypeRatio: CGFloat = 100

    var body: some View {
        let size = RecitationFont.size(scale: scale) * dynamicTypeRatio / 100
        Text(Self.attributed(text, size: size))
            .font(.custom(RecitationFont.regular, fixedSize: size))
            .lineSpacing(size * RecitationFont.lineSpacing)
            .multilineTextAlignment(alignment)
            .typesettingLanguage(Locale.Language(identifier: "ar"))
            .frame(maxWidth: .infinity, alignment: alignment == .center ? .center : .leading)
            .environment(\.layoutDirection, .rightToLeft)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(Text(verbatim: text))
    }

    static let noBreakSpace = "\u{00A0}"

    static func attributed(_ text: String, size: CGFloat) -> AttributedString {
        var result = AttributedString()
        for segment in RecitationText.segments(text) {
            switch segment {
            case let .text(plain):
                result += AttributedString(plain)
            case let .pauseGroup(word, mark):
                result += AttributedString(word)
                // `mark` is a space and a combining sign: one Character, so split by scalar.
                let signs = String(String.UnicodeScalarView(mark.unicodeScalars.drop { $0 == " " }))
                var sign = AttributedString(noBreakSpace + signs)
                sign.baselineOffset = -size * RecitationFont.pauseMarkDrop
                sign.foregroundColor = Color.accentColor
                result += sign
            case let .signGroup(word, sign):
                // The sajdah sign ۩ is a symbol of its own: shown as written, only kept on its word's line.
                let symbol = String(String.UnicodeScalarView(sign.unicodeScalars.drop { $0 == " " }))
                result += AttributedString(word + noBreakSpace + symbol)
            }
        }
        result.languageIdentifier = "ar"
        return result
    }
}

#Preview("Recitation", traits: .sizeThatFitsLayout) {
    let dataset = AzkarDataset.bundled
    ScrollView {
        RecitationView(text: dataset.dhikr(id: "ayat-al-kursi")?.arabic ?? "")
            .padding()
    }
}
