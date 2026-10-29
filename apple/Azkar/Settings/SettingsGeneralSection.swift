import AzkarKit
import SwiftUI
import UIKit

/// Appearance, language, numerals and the Hijri date.
struct SettingsGeneralSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    private var settings: AppSettings { app.settings.settings.app }

    var body: some View {
        Section {
            Picker(selection: binding(\.theme)) {
                ForEach(AppSettings.Theme.allCases, id: \.self) { theme in
                    Text(SettingsText.theme(theme, locale: locale)).tag(theme)
                }
            } label: {
                Label { Text("Appearance", tableName: SettingsText.table) } icon: { Image(systemName: "circle.lefthalf.filled") }
            }

            Picker(selection: binding(\.language)) {
                ForEach(AppSettings.Language.allCases, id: \.self) { language in
                    Text(SettingsText.language(language, locale: locale)).tag(language)
                }
            } label: {
                Label { Text("Language", tableName: SettingsText.table) } icon: { Image(systemName: "globe") }
            }

            if let url = URL(string: UIApplication.openSettingsURLString) {
                Link(destination: url) {
                    Label {
                        Text("iPhone language settings for Azkar", tableName: SettingsText.table)
                    } icon: {
                        Image(systemName: "arrow.up.forward.app")
                    }
                }
            }

            Toggle(isOn: binding(\.arabicDigits)) {
                Label {
                    Text("Arabic-Indic numerals", tableName: SettingsText.table)
                    Text("Show ١٢٣ instead of 123 when the app is in Arabic.", tableName: SettingsText.table)
                } icon: {
                    Image(systemName: "textformat.123")
                }
            }

            Stepper(value: binding(\.hijriOffset), in: AppSettings.hijriOffsetRange) {
                Label {
                    LabeledContent {
                        Text(offsetText)
                            .monospacedDigit()
                            .contentTransition(.numericText(value: Double(settings.hijriOffset)))
                    } label: {
                        Text("Hijri date", tableName: SettingsText.table)
                        Text(hijriToday)
                    }
                } icon: {
                    Image(systemName: "moon")
                }
            }
            .accessibilityValue(Text(offsetAccessibility))
        } header: {
            Text("General", tableName: SettingsText.table)
        } footer: {
            Text("“Same as iPhone” follows the language chosen for Azkar in the iPhone’s Settings. Move the Hijri date by a day or two to match the moon sighting where you live.", tableName: SettingsText.table)
        }
    }

    private var offsetText: String {
        SettingsText.signed(settings.hijriOffset, locale: locale)
    }

    private var offsetAccessibility: String {
        settings.hijriOffset == 0 ? SettingsText.string("No change", locale: locale) : SettingsText.string("\(settings.hijriOffset) days", locale: locale)
    }

    /// Today's Hijri date with the adjustment, to see its effect at once.
    private var hijriToday: String {
        let today = DayKey(.now, in: app.settings.settings.timeZone)
        return HijriFormat.full(today, offset: settings.hijriOffset, locale: SettingsLocale.displayLocale(locale, arabicDigits: settings.arabicDigits))
    }

    private func binding<Value>(_ path: WritableKeyPath<AppSettings, Value>) -> Binding<Value> {
        Binding(
            get: { app.settings.settings.app[keyPath: path] },
            set: { value in app.settings.update { $0.app[keyPath: path] = value } }
        )
    }
}
