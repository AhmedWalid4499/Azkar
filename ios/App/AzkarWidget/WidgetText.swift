import Foundation

private final class WidgetBundleToken {}

extension Bundle {
    /// The bundle with the widgets' strings and colours: the extension, or the test bundle in tests.
    static let widget = Bundle(for: WidgetBundleToken.self)
}

/// The widgets' wording and number style. Once the app has published, the text comes from the
/// app, in the app's language (src/features/widget/strings.ts); before that, and for anything
/// missing, from this extension's Localizable.strings in the phone's language.
struct WidgetText: Equatable {
    let labels: [String: String]
    let isArabic: Bool
    let arabicDigits: Bool

    init(snapshot: WidgetSnapshot?) {
        if let snapshot {
            labels = snapshot.labels
            isArabic = snapshot.lang == "ar"
            arabicDigits = snapshot.arabicDigits
        } else {
            labels = [:]
            isArabic = Bundle.widget.preferredLocalizations.first == "ar"
            arabicDigits = isArabic
        }
    }

    func label(_ key: String) -> String {
        if let value = labels[key], !value.isEmpty { return value }
        return NSLocalizedString(key, bundle: .widget, comment: "")
    }

    func prayer(_ name: String) -> String { label("prayer.\(name)") }

    func status(_ status: String) -> String { label("status.\(status)") }

    /// "As-salamu alaykum, {name}" with the name in, or nil when the user gave none.
    var greeting: String? {
        guard let greeting = labels["greeting"], !greeting.isEmpty else { return nil }
        return greeting
    }

    /// What VoiceOver reads for one of today's prayers.
    func rowLabel(_ slot: PrayerSlot) -> String {
        let values = ["prayer": prayer(slot.prayer), "time": slot.time]
        guard let status = slot.status else { return Self.fill(label("unloggedRow"), values) }
        return Self.fill(label("loggedRow"), values.merging(["status": self.status(status)]) { $1 })
    }

    /// For the countdown, which the widget formats itself.
    var locale: Locale {
        guard isArabic else { return Locale(identifier: "en") }
        return Locale(identifier: arabicDigits ? "ar@numbers=arab" : "ar@numbers=latn")
    }

    static func fill(_ template: String, _ values: [String: String]) -> String {
        values.reduce(template) { text, value in text.replacingOccurrences(of: "{\(value.key)}", with: value.value) }
    }
}
