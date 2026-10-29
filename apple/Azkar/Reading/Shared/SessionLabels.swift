import AzkarKit
import SwiftUI

/// How each session is named and drawn across the Azkar tab.
extension AzkarSession {
    var readingTitle: Text {
        switch self {
        case .morning: Text("Morning azkar", tableName: "Reading")
        case .evening: Text("Evening azkar", tableName: "Reading")
        case .sleep: Text("Before sleep", tableName: "Reading")
        case .afterPrayer(.fajr): Text("After Fajr", tableName: "Reading")
        case .afterPrayer(.dhuhr): Text("After Dhuhr", tableName: "Reading")
        case .afterPrayer(.asr): Text("After Asr", tableName: "Reading")
        case .afterPrayer(.maghrib): Text("After Maghrib", tableName: "Reading")
        case .afterPrayer(.isha): Text("After Isha", tableName: "Reading")
        }
    }

    /// The session's Arabic name, shown with the English one in the English interface (as the
    /// website's picker cards). Interface wording, not recitation text.
    var readingArabicTitle: String {
        switch self {
        case .morning: "أذكار الصباح"
        case .evening: "أذكار المساء"
        case .sleep: "أذكار النوم"
        case .afterPrayer(.fajr): "أذكار بعد صلاة الفجر"
        case .afterPrayer(.dhuhr): "أذكار بعد صلاة الظهر"
        case .afterPrayer(.asr): "أذكار بعد صلاة العصر"
        case .afterPrayer(.maghrib): "أذكار بعد صلاة المغرب"
        case .afterPrayer(.isha): "أذكار بعد صلاة العشاء"
        }
    }

    var readingCompletionTitle: Text {
        switch self {
        case .morning: Text("Morning azkar complete", tableName: "Reading")
        case .evening: Text("Evening azkar complete", tableName: "Reading")
        case .sleep: Text("Bedtime azkar complete", tableName: "Reading")
        case .afterPrayer(.fajr): Text("Azkar after Fajr complete", tableName: "Reading")
        case .afterPrayer(.dhuhr): Text("Azkar after Dhuhr complete", tableName: "Reading")
        case .afterPrayer(.asr): Text("Azkar after Asr complete", tableName: "Reading")
        case .afterPrayer(.maghrib): Text("Azkar after Maghrib complete", tableName: "Reading")
        case .afterPrayer(.isha): Text("Azkar after Isha complete", tableName: "Reading")
        }
    }

    var readingSymbol: String {
        switch self {
        case .morning: "sunrise.fill"
        case .evening: "sunset.fill"
        case .sleep: "moon.zzz.fill"
        case .afterPrayer(.fajr): "sun.horizon"
        case .afterPrayer(.dhuhr): "sun.max"
        case .afterPrayer(.asr): "sun.haze"
        case .afterPrayer(.maghrib): "sunset"
        case .afterPrayer(.isha): "moon.stars"
        }
    }

    /// A colour that sets the mood of the session's icon (never the only sign of anything).
    var readingTint: Color {
        switch self {
        case .morning: .orange
        case .evening: .indigo
        case .sleep: .purple
        case .afterPrayer: .teal
        }
    }
}
