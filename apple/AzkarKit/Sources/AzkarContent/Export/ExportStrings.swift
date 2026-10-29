import AzkarCore
import Foundation

/// The words of the tracker's export, in both languages. The website's are copied exactly from
/// `src/features/prayer-log/strings.ts`, `src/shared/i18n/common.ts` and
/// `src/features/azkar/strings.ts` (the fasting and after-prayer ones from the web branch), so
/// a file exported by either app reads the same.
struct ExportStrings: Sendable {
    let language: DisplayLanguage

    private var ar: Bool { language == .ar }

    var date: String { ar ? "التاريخ" : "Date" }
    var hijri: String { ar ? "التاريخ الهجري" : "Hijri date" }
    var timeZone: String { ar ? "المنطقة الزمنية" : "Time zone" }
    func status(_ prayer: String) -> String { ar ? "\(prayer): الحالة" : "\(prayer): status" }
    func loggedAt(_ prayer: String) -> String { ar ? "\(prayer): وقت التسجيل" : "\(prayer): logged at" }
    func sunnah(_ sunnah: String) -> String { ar ? "\(sunnah): وقت التسجيل" : "\(sunnah): logged at" }
    func sessionStatus(_ session: String) -> String { ar ? "\(session): الحالة" : "\(session): status" }
    func sessionStartedAt(_ session: String) -> String { ar ? "\(session): وقت البدء" : "\(session): started at" }
    func sessionFinishedAt(_ session: String) -> String { ar ? "\(session): وقت الإتمام" : "\(session): finished at" }
    func sessionLastAt(_ session: String) -> String { ar ? "\(session): وقت آخر عدّ" : "\(session): last count at" }
    func sessionDone(_ session: String) -> String { ar ? "\(session): الأذكار المكتملة" : "\(session): azkar done" }
    func sessionTotal(_ session: String) -> String { ar ? "\(session): عدد الأذكار" : "\(session): azkar in session" }
    func sessionRecitations(_ session: String) -> String { ar ? "\(session): مرات الذكر" : "\(session): recitations" }
    var completed: String { ar ? "مكتملة" : "Completed" }
    var inProgress: String { ar ? "لم تكتمل" : "In progress" }

    func prayer(_ prayer: Prayer) -> String {
        switch prayer {
        case .fajr: ar ? "الفجر" : "Fajr"
        case .dhuhr: ar ? "الظهر" : "Dhuhr"
        case .asr: ar ? "العصر" : "Asr"
        case .maghrib: ar ? "المغرب" : "Maghrib"
        case .isha: ar ? "العشاء" : "Isha"
        }
    }

    func status(_ status: PrayerStatus) -> String {
        switch status {
        case .ontime: ar ? "في وقتها" : "On time"
        case .jamaah: ar ? "جماعة" : "Jamaah"
        case .late: ar ? "قضاء" : "Late"
        case .missed: ar ? "فائتة" : "Missed"
        case .excused: ar ? "عذر" : "Excused"
        }
    }

    func sunnah(_ sunnah: SunnahPrayer) -> String {
        switch sunnah {
        case .beforeFajr: ar ? "ركعتان قبل الفجر" : "2 before Fajr"
        case .duha: ar ? "الضحى" : "Duha"
        case .beforeDhuhr: ar ? "أربع ركعات قبل الظهر" : "4 before Dhuhr"
        case .afterDhuhr: ar ? "ركعتان بعد الظهر" : "2 after Dhuhr"
        case .afterMaghrib: ar ? "ركعتان بعد المغرب" : "2 after Maghrib"
        case .afterIsha: ar ? "ركعتان بعد العشاء" : "2 after Isha"
        case .qiyam: ar ? "قيام الليل" : "Night prayer"
        case .witr: ar ? "الوتر" : "Witr"
        }
    }

    func session(_ session: AzkarSession) -> String {
        switch session {
        case .morning: ar ? "أذكار الصباح" : "Morning azkar"
        case .evening: ar ? "أذكار المساء" : "Evening azkar"
        case .sleep: ar ? "أذكار النوم" : "Before sleep"
        case let .afterPrayer(prayer): ar ? "أذكار بعد صلاة \(self.prayer(prayer))" : "Azkar after \(self.prayer(prayer))"
        }
    }

    // MARK: - Added by the native app

    var tasbihFree: String { ar ? "عدّ حرّ" : "Free count" }
    func tasbihCount(_ preset: String) -> String { ar ? "التسبيح: \(preset): العدد" : "Tasbih: \(preset): count" }
    func tasbihLastAt(_ preset: String) -> String { ar ? "التسبيح: \(preset): وقت آخر عدّ" : "Tasbih: \(preset): last count at" }

    var fastKindHeader: String { ar ? "الصيام" : "Fast" }
    var fastStatusHeader: String { ar ? "الصيام: الحالة" : "Fast: status" }
    var fastLoggedAtHeader: String { ar ? "الصيام: وقت التسجيل" : "Fast: logged at" }

    func fastKind(_ kind: FastKind) -> String {
        switch kind {
        case .ramadan: ar ? "صيام رمضان" : "Ramadan fast"
        case .qada: ar ? "قضاء رمضان" : "Make-up fast"
        case .voluntary: ar ? "صيام تطوع" : "Voluntary fast"
        }
    }

    func fastStatus(_ status: FastStatus) -> String {
        switch status {
        case .fasted: ar ? "صيام تام" : "Fasted"
        case .broken: ar ? "صيام لم يكتمل" : "Broke the fast"
        case .excused: ar ? "إفطار بعذر" : "Excused"
        case .missed: ar ? "إفطار بلا عذر" : "Did not fast"
        }
    }
}
