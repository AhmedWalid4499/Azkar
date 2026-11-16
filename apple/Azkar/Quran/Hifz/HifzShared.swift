import AzkarKit
import SwiftUI

/// What a surah and its ayat are called on screen: "Al-Baqara 1–143", or the name alone for a whole surah.
extension ReadingLocale {
    func suraName(_ sura: QuranSura) -> String { isArabic ? sura.name : sura.transliteration }

    func span(_ span: AyahSpan, in mushaf: QuranMushaf) -> String {
        let name = suraName(mushaf.suras[span.sura - 1])
        if span.isWholeSura { return name }
        if span.from == span.to { return "\(name) \(number(span.from))" }
        return "\(name) \(number(span.from))–\(number(span.to))"
    }

    func spans(_ spans: [AyahSpan], in mushaf: QuranMushaf) -> String {
        spans.map { span($0, in: mushaf) }.joined(separator: isArabic ? "، " : ", ")
    }

    func day(_ day: DayKey) -> String {
        day.noonUTC.formatted(Date.FormatStyle(date: .abbreviated, time: .omitted, locale: formatting, timeZone: .gmt))
    }
}

extension HifzStrength {
    var title: LocalizedStringResource {
        switch self {
        case .weak: QL("Weak")
        case .good: QL("Good")
        case .strong: QL("Strong")
        }
    }

    var detail: LocalizedStringResource {
        switch self {
        case .weak: QL("Many slips: again tomorrow")
        case .good: QL("A few slips")
        case .strong: QL("No slips")
        }
    }

    var symbol: String {
        switch self {
        case .weak: "exclamationmark.circle"
        case .good: "checkmark.circle"
        case .strong: "star.circle"
        }
    }
}

extension HifzMap.Standing {
    /// The map's colours: weak warm, unreviewed blue, then greens as it holds better.
    var color: Color {
        switch self {
        case .weak: .orange
        case .unrated: .blue
        case .good: .teal
        case .strong: .green
        }
    }

    var title: LocalizedStringResource {
        switch self {
        case .weak: QL("Weak")
        case .unrated: QL("Not reviewed yet")
        case .good: QL("Good")
        case .strong: QL("Strong")
        }
    }
}

/// The three ways a review can go, as buttons in a menu.
struct HifzStrengthButtons: View {
    let action: (HifzStrength) -> Void

    var body: some View {
        ForEach(HifzStrength.allCases.reversed(), id: \.self) { strength in
            Button {
                action(strength)
            } label: {
                Label { Text(strength.title); Text(strength.detail) } icon: { Image(systemName: strength.symbol) }
            }
        }
    }
}

/// A number typed in Western or Arabic-Indic digits (the Arabic keyboard's number pad).
struct HifzNumberField: View {
    let title: LocalizedStringResource
    @Binding var value: Int
    let range: ClosedRange<Int>
    @State private var text = ""
    @Environment(\.readingLocale) private var format

    var body: some View {
        LabeledContent {
            TextField(text: $text) { Text(verbatim: format.number(range.lowerBound)) }
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .frame(maxWidth: 120)
                .onChange(of: text) { _, typed in
                    if let number = Self.number(typed) { value = number }
                }
        } label: {
            Text(title)
        }
        .onAppear { text = format.number(value) }
        .onChange(of: value) { _, new in
            if Self.number(text) != new { text = format.number(new) }
        }
    }

    static func number(_ text: String) -> Int? {
        let digits = String(text.trimmingCharacters(in: .whitespaces).unicodeScalars.compactMap { scalar -> Character? in
            switch scalar.value {
            case 0x660...0x669: Character(Unicode.Scalar(scalar.value - 0x660 + 0x30)!)
            case 0x6F0...0x6F9: Character(Unicode.Scalar(scalar.value - 0x6F0 + 0x30)!)
            case 0x30...0x39: Character(scalar)
            default: nil
            }
        })
        return Int(digits)
    }
}

/// A surah chosen from the 114, by number and name.
struct HifzSuraPicker: View {
    let title: LocalizedStringResource
    let mushaf: QuranMushaf
    @Binding var sura: Int
    @Environment(\.readingLocale) private var format

    var body: some View {
        Picker(selection: $sura) {
            ForEach(mushaf.suras) { sura in
                Text(verbatim: "\(format.number(sura.number)). \(format.suraName(sura))").tag(sura.number)
            }
        } label: {
            Text(title)
        }
        .pickerStyle(.navigationLink)
    }
}

enum HifzLog {
    /// The instant a line logged for `day` is filed at: now for today, else midday of that day, so
    /// the log keeps the order things happened in.
    static func instant(for day: DayKey, today: DayKey, timeZone: TimeZone) -> Date {
        guard day != today else { return .now }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: 12)) ?? day.noonUTC
    }
}
