import AzkarKit
import SwiftUI

/// One dhikr, read top to bottom: the Arabic recitation, then (per the reader settings) its
/// transliteration and translation, how to count it, its reference and its virtue.
struct DhikrPageView: View {
    let dhikr: Dhikr
    let position: Int
    let total: Int
    let settings: ReaderSettings
    @Environment(\.readingLocale) private var locale
    @State private var showsVirtue = false

    var body: some View {
        let centered = RecitationText.isShortPassage(dhikr.arabic)
        let showsTransliteration = ReaderSettings.resolve(settings.showTransliteration, languageCode: locale.languageCode)
        let showsTranslation = ReaderSettings.resolve(settings.showTranslation, languageCode: locale.languageCode)
        let transliteration = showsTransliteration ? dhikr.transliteration?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" : ""
        let translation = showsTranslation ? dhikr.translation.trimmingCharacters(in: .whitespacesAndNewlines) : ""
        let note = dhikr.note?.prose(for: locale.display) ?? ""
        let reference = dhikr.reference.prose(for: locale.display)
        let virtue = dhikr.virtue?.prose(for: locale.display) ?? ""

        ScrollView {
            VStack(alignment: centered ? .center : .leading, spacing: 20) {
                Text("Dhikr \(position) of \(total)", tableName: "Reading")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
                    .accessibilityAddTraits(.isHeader)

                RecitationView(text: dhikr.arabic, scale: settings.arabicScale, alignment: centered ? .center : .leading)
                    .textSelection(.enabled)

                if !note.isEmpty {
                    Label { Text(verbatim: note) } icon: { Image(systemName: "info.circle") }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.accentColor)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 12))
                }

                if !transliteration.isEmpty || !translation.isEmpty {
                    Ornament()
                }
                if !transliteration.isEmpty {
                    Text(verbatim: transliteration)
                        .font(.body.italic())
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(centered ? .center : .leading)
                        .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
                        .environment(\.layoutDirection, .leftToRight)
                        .textSelection(.enabled)
                }
                if !translation.isEmpty {
                    Text(verbatim: translation)
                        .font(.body)
                        .multilineTextAlignment(centered ? .center : .leading)
                        .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
                        .environment(\.layoutDirection, .leftToRight)
                        .textSelection(.enabled)
                }

                VStack(alignment: .leading, spacing: 12) {
                    if !reference.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Reference", tableName: "Reading")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(verbatim: reference)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    if !virtue.isEmpty {
                        DisclosureGroup(isExpanded: $showsVirtue) {
                            Text(verbatim: virtue)
                                .font(.subheadline)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 6)
                        } label: {
                            Label { Text("Virtue", tableName: "Reading") } icon: { Image(systemName: "sparkles") }
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.fill.quaternary, in: .rect(cornerRadius: 16))
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

/// A quiet divider between the Arabic and the reading aids.
private struct Ornament: View {
    var body: some View {
        HStack(spacing: 10) {
            Capsule().frame(width: 28, height: 1)
            Image(systemName: "diamond.fill").font(.system(size: 6))
            Capsule().frame(width: 28, height: 1)
        }
        .foregroundStyle(.tertiary)
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }
}

#Preview("Ayat al-Kursi") {
    let dataset = AzkarDataset.bundled
    if let dhikr = dataset.dhikr(id: "ayat-al-kursi") {
        DhikrPageView(dhikr: dhikr, position: 1, total: 23, settings: .default)
    }
}
