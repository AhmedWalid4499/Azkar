#if DEBUG
import AzkarKit
import Foundation

/// Debug-build launch arguments for the Calendar and timetable features, for unattended runs in
/// the simulator (grant Calendar first with `xcrun simctl privacy <device> grant calendar <bundle id>`):
///
/// - `-PrayerExportDebug add-month,add-month,add-year,remove` runs each step in turn and prints
///   what the app's calendar then holds.
/// - `-PrayerExportDebugPDF` writes this Gregorian and this Hijri month's timetable in English and
///   Arabic to Documents/timetable/.
enum PrayerExportDebug {
    static func run(_ app: AppEnvironment) async {
        let defaults = UserDefaults.standard
        let settings = app.settings.settings
        let locale = switch settings.app.language { case .ar: Locale(identifier: "ar"); case .en: Locale(identifier: "en"); case .system: Locale.current }
        let title = PrayerExportText.string("Prayer times", locale: locale)
        if let steps = defaults.string(forKey: "PrayerExportDebug") {
            for step in steps.split(separator: ",") {
                do {
                    switch step {
                    case "add-month", "add-year":
                        guard let plan = PrayerExportSection.plan(months: step == "add-month" ? 1 : 12, settings: settings, locale: locale) else {
                            print("PrayerExportDebug: no place")
                            return
                        }
                        let record = try await PrayerCalendarSync.shared.add(plan)
                        print("PrayerExportDebug: \(step) planned \(plan.items.count), saved \(record.eventIDs.count)")
                    case "remove":
                        try await PrayerCalendarSync.shared.remove()
                        print("PrayerExportDebug: removed")
                    default:
                        print("PrayerExportDebug: unknown step \(step)")
                    }
                } catch {
                    print("PrayerExportDebug: \(step) failed: \(error)")
                }
                print("PrayerExportDebug: after \(step): \(await PrayerCalendarSync.shared.debugSummary(title: title))")
            }
        }
        if defaults.bool(forKey: "PrayerExportDebugPDF") {
            let folder = URL.documentsDirectory.appending(path: "timetable", directoryHint: .isDirectory)
            try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let today = DayKey(.now, in: settings.timeZone)
            for code in ["en", "ar"] {
                for kind in TimetableMonth.Kind.allCases {
                    let month = TimetableMonth.containing(today, kind: kind, hijriOffset: settings.app.hijriOffset)
                    guard let document = TimetableDocument.make(month: month, settings: settings, locale: Locale(identifier: code), today: today) else { continue }
                    let url = folder.appending(path: "\(code)-\(kind.rawValue).pdf")
                    do {
                        try document.writePDF(to: url)
                        print("PrayerExportDebug: wrote \(url.path) (\(document.pages.count) page, \(document.rows.count) days)")
                    } catch {
                        print("PrayerExportDebug: PDF failed: \(error)")
                    }
                }
            }
        }
    }
}
#endif
