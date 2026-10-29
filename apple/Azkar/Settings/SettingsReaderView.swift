import AzkarKit
import SwiftUI

/// How the azkar reader behaves: the Arabic text size (with a live preview), the aids shown
/// beside the Arabic, and the reader's haptics, screen and pace.
struct SettingsReaderView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    private var reader: ReaderSettings { app.settings.settings.reader }
    private var languageCode: String { SettingsLocale.isArabic(locale) ? "ar" : "en" }

    var body: some View {
        Form {
            Section {
                SettingsArabicSizePreview(scale: reader.arabicScale, text: previewText)
                Slider(
                    value: scaleBinding,
                    in: Double(ReaderSettings.arabicScales.lowerBound)...Double(ReaderSettings.arabicScales.upperBound),
                    step: 1
                ) {
                    Text("Arabic text size", tableName: SettingsText.table)
                } minimumValueLabel: {
                    Image(systemName: "textformat.size.smaller").accessibilityHidden(true)
                } maximumValueLabel: {
                    Image(systemName: "textformat.size.larger").accessibilityHidden(true)
                }
                .accessibilityValue(Text(reader.arabicScale.formatted(.number.locale(locale))))
            } header: {
                Text("Arabic text size", tableName: SettingsText.table)
            }
            .sensoryFeedback(.selection, trigger: reader.arabicScale)

            Section {
                Toggle(isOn: aidBinding(\.showTransliteration)) {
                    Text("Show transliteration", tableName: SettingsText.table)
                    Text("The Arabic written in Latin letters.", tableName: SettingsText.table)
                }
                Toggle(isOn: aidBinding(\.showTranslation)) {
                    Text("Show translation", tableName: SettingsText.table)
                    Text("The meaning in English.", tableName: SettingsText.table)
                }
            }

            Section {
                Toggle(isOn: binding(\.haptics)) {
                    Text("Haptic feedback", tableName: SettingsText.table)
                    Text("A light tap with each count.", tableName: SettingsText.table)
                }
                Toggle(isOn: binding(\.keepAwake)) {
                    Text("Keep the screen on", tableName: SettingsText.table)
                    Text("Stops the screen dimming while you read.", tableName: SettingsText.table)
                }
                Toggle(isOn: binding(\.autoAdvance)) {
                    Text("Auto-advance", tableName: SettingsText.table)
                    Text("Moves to the next dhikr when its count is reached.", tableName: SettingsText.table)
                }
            }
        }
        .navigationTitle(Text("Azkar reader", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// A short dhikr of the morning, from the dataset (never typed here).
    private var previewText: String? {
        let morning = app.dataset.azkar(for: .morning)
        return (morning.first { $0.arabic.count <= 110 } ?? morning.first)?.arabic
    }

    private var scaleBinding: Binding<Double> {
        Binding(
            get: { Double(reader.arabicScale) },
            set: { value in app.settings.update { $0.reader.arabicScale = Int(value.rounded()) } }
        )
    }

    private func binding(_ path: WritableKeyPath<ReaderSettings, Bool>) -> Binding<Bool> {
        Binding(
            get: { app.settings.settings.reader[keyPath: path] },
            set: { value in app.settings.update { $0.reader[keyPath: path] = value } }
        )
    }

    /// Shown in English and hidden in Arabic until the user chooses.
    private func aidBinding(_ path: WritableKeyPath<ReaderSettings, Bool?>) -> Binding<Bool> {
        Binding(
            get: { ReaderSettings.resolve(app.settings.settings.reader[keyPath: path], languageCode: languageCode) },
            set: { value in app.settings.update { $0.reader[keyPath: path] = value } }
        )
    }
}

/// The Arabic at the chosen size, in the reader's typeface.
struct SettingsArabicSizePreview: View {
    let scale: Int
    let text: String?

    /// Point sizes of the five steps at the default Dynamic Type size; they grow with it.
    static let sizes: [CGFloat] = [22, 26, 30, 36, 42]

    var body: some View {
        let size = Self.sizes[min(Self.sizes.count, max(1, scale)) - 1]
        Text(text ?? "")
            .font(.custom("Amiri", size: size, relativeTo: .title))
            .lineSpacing(size * 0.35)
            .multilineTextAlignment(.center)
            .environment(\.layoutDirection, .rightToLeft)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .animation(.smooth(duration: 0.2), value: scale)
            .accessibilityHidden(true)
    }
}

#Preview {
    NavigationStack { SettingsReaderView() }
        .environment(try! AppEnvironment())
}
