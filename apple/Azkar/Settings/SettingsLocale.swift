import AzkarKit
import SwiftUI

/// The locale numbers are written in: the interface's, with Arabic-Indic or Western digits in
/// Arabic as the user chose ("Numerals" in Settings). English always writes Western digits.
enum SettingsLocale {
    static func display(_ base: Locale, arabicDigits: Bool) -> Locale {
        guard isArabic(base) else { return base }
        var components = Locale.Components(locale: base)
        components.numberingSystem = Locale.NumberingSystem(arabicDigits ? "arab" : "latn")
        return Locale(components: components)
    }

    static func isArabic(_ locale: Locale) -> Bool {
        locale.language.languageCode == .arabic
    }

    /// The same choice for text AzkarKit builds (Hijri dates, export headers).
    static func displayLocale(_ locale: Locale, arabicDigits: Bool) -> DisplayLocale {
        DisplayLocale(language: isArabic(locale) ? .ar : .en, arabicIndicDigits: arabicDigits)
    }
}

/// Sets the environment's locale to write numbers in the digits the user chose.
struct SettingsChosenDigits: ViewModifier {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    func body(content: Content) -> some View {
        content.environment(\.locale, SettingsLocale.display(locale, arabicDigits: app.settings.settings.app.arabicDigits))
    }
}

extension View {
    /// Numbers in this view follow the user's choice of digits.
    func settingsChosenDigits() -> some View { modifier(SettingsChosenDigits()) }
}
