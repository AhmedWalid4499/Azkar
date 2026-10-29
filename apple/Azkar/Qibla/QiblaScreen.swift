import AzkarKit
import SwiftUI

/// The Qibla tab: the direction of the Kaaba from the saved place, on a compass that turns with
/// the phone where it has one.
struct QiblaScreen: View {
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(Text("Qibla", tableName: QiblaText.table))
        }
        .settingsChosenDigits()
        #if DEBUG
        .task { SettingsDemo.applyOnce(to: app) }
        #endif
    }

    @ViewBuilder private var content: some View {
        if let location = app.settings.settings.location, PrayerPlace(location) != nil {
            let direction = QiblaDirection(latitude: location.latitude, longitude: location.longitude)
            if direction.isNear {
                QiblaNearView(location: location)
            } else {
                QiblaCompassView(location: location, direction: direction)
            }
        } else {
            QiblaNoLocationView()
        }
    }
}

/// Text built in code for this tab, in the interface language.
enum QiblaText {
    static let table = "Qibla"

    static func string(_ key: String.LocalizationValue, locale: Locale) -> String {
        String(localized: LocalizedStringResource(key, table: table, locale: locale))
    }

    /// Whole degrees with the sign, kept left to right so the sign stays after the number in Arabic.
    static func degrees(_ value: Double, locale: Locale) -> String {
        let whole = Int(value.rounded()) % 360
        return "\u{2066}\(whole.formatted(.number.grouping(.never).locale(locale)))°\u{2069}"
    }

    static func distance(_ kilometres: Double, locale: Locale) -> String {
        Measurement(value: kilometres, unit: UnitLength.kilometers)
            .formatted(.measurement(width: .abbreviated, usage: .asProvided, numberFormatStyle: .number.precision(.fractionLength(0))).locale(locale))
    }

    /// "Toward the southeast".
    static func toward(_ point: CompassPoint, locale: Locale) -> String {
        switch point {
        case .n: string("Toward the north", locale: locale)
        case .ne: string("Toward the northeast", locale: locale)
        case .e: string("Toward the east", locale: locale)
        case .se: string("Toward the southeast", locale: locale)
        case .s: string("Toward the south", locale: locale)
        case .sw: string("Toward the southwest", locale: locale)
        case .w: string("Toward the west", locale: locale)
        case .nw: string("Toward the northwest", locale: locale)
        }
    }

    /// How far the phone still has to turn, or that it faces the Qibla.
    static func turn(_ turn: Double, aligned: Bool, locale: Locale) -> String {
        if aligned { return string("You’re facing the Qibla", locale: locale) }
        let amount = degrees(abs(turn), locale: locale)
        return turn > 0 ? string("Turn right \(amount)", locale: locale) : string("Turn left \(amount)", locale: locale)
    }
}

#Preview {
    QiblaScreen()
        .environment(try! AppEnvironment())
}
