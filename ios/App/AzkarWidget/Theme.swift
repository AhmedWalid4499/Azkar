import SwiftUI
import WidgetKit

/// The app's colours (src/shared/styles/tokens.css), light and dark, from the asset catalog.
enum Palette {
    /// `--bg`
    static let background = color("WidgetBackground")
    /// `--ink` and `--ink-2`
    static let ink = color("Ink")
    static let inkSecondary = color("InkSecondary")
    /// `--primary` and `--primary-soft`
    static let primary = color("AccentColor")
    static let primarySoft = color("PrimarySoft")

    /// The colour of a logged status, as in the app's tracker (src/features/prayer-log/status.module.css).
    static func status(_ status: String) -> Color {
        switch status {
        case "jamaah": return color("StatusJamaah")
        case "late": return color("StatusLate")
        case "missed": return color("StatusMissed")
        case "excused": return color("StatusExcused")
        default: return primary
        }
    }

    private static func color(_ name: String) -> Color {
        Color(name, bundle: .widget)
    }
}

/// One shape per status, so a status never rests on its colour alone (src/features/prayer-log/StatusIcon.tsx).
enum StatusSymbol {
    static func name(for status: String?) -> String {
        switch status {
        case "ontime": return "checkmark.circle.fill"
        case "jamaah": return "person.2.circle.fill"
        case "late": return "clock.arrow.circlepath"
        case "missed": return "xmark.circle.fill"
        case "excused": return "minus.circle.fill"
        default: return "circle"
        }
    }
}

extension View {
    /// The widget's background: the system's container on iOS 17 and later, which requires it,
    /// and a padded background before.
    @ViewBuilder
    func widgetBackground<Background: View>(_ background: Background) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { background }
        } else {
            padding().background(background)
        }
    }
}
