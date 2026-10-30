import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The settings' validation (parity with the website's sanitize functions, sanitize.json) and
/// their storage.
@Suite struct SettingsTests {
    static let fixture = try! Fixtures.json("sanitize.json")

    struct Sample: CustomTestStringConvertible, Sendable {
        let input: JSONValue
        let output: JSONValue
        var testDescription: String { input.text }
    }

    static func samples(_ key: String) -> [Sample] {
        fixture[key]!.array!.map { Sample(input: $0["input"]!, output: $0["output"]!) }
    }

    @Test("Names are cleaned as the website's sanitizeName", arguments: samples("names"))
    func namesAreCleanedLikeTheWebsite(_ sample: Sample) {
        let cleaned = sample.input.string.map(AppSettings.sanitizeName) ?? ""
        #expect(cleaned == sample.output.string, "\(Array(cleaned.unicodeScalars).map { String($0.value, radix: 16) })")
    }

    @Test("App settings read as the website's sanitizeSettings", arguments: samples("settings"))
    func appSettingsReadLikeTheWebsite(_ sample: Sample) {
        expectSameJSON(AppSettings(web: sample.input).web, sample.output, "settings")
    }

    @Test("Reader settings read as the website's sanitizeAzkarSettings", arguments: samples("azkarSettings"))
    func readerSettingsReadLikeTheWebsite(_ sample: Sample) {
        expectSameJSON(ReaderSettings(web: sample.input).web.only(Array(ReaderSettings.mainBranchFields)), sample.output, "azkar-settings")
    }

    @Test("Calculation and reminder settings read as the website's sanitizeSettings", arguments: samples("prayerTimes"))
    func prayerTimesSettingsReadLikeTheWebsite(_ sample: Sample) {
        var written = CalculationConfig(web: sample.input).web.object!
        written.merge(ReminderSettings(web: sample.input).web.object!) { _, reminder in reminder }
        expectSameJSON(JSONValue.object(written).only(WebHydrationParityTests.prayerTimesFields), sample.output, "prayer-times")
    }

    @Test func remindersOfTheWIPBranchAndTheAdhanAlarmsAreRead() {
        let reminders = ReminderSettings(web: [
            "unloggedReminders": ["enabled": false, "leadMinutes": 45, "ishaEnds": "fajr"],
            "adhanAlarms": ["fajr": true, "isha": true, "asr": "yes"],
        ])
        #expect(!reminders.unlogged && reminders.unloggedLeadMinutes == 45 && reminders.ishaDeadline == .fajr)
        #expect(reminders.adhan == [.fajr, .isha])
        let defaults = ReminderSettings(web: ["unloggedReminders": ["enabled": "no", "leadMinutes": 20, "ishaEnds": "dawn"]])
        #expect(defaults.unlogged && defaults.unloggedLeadMinutes == 15 && defaults.ishaDeadline == .middle)
    }

    @Test func tasbihChoicesOfTheWIPBranchAreRead() {
        let reader = ReaderSettings(web: ["tasbihPreset": "subhanallah", "tasbihFree": true, "tasbihTarget": 99])
        #expect(reader.tasbihPreset == "subhanallah" && reader.tasbihFree && reader.tasbihTarget == 99)
        #expect(ReaderSettings(web: ["tasbihTarget": .null]).tasbihTarget == nil)
        #expect(ReaderSettings(web: ["tasbihTarget": 0, "tasbihPreset": ""]).tasbihTarget == 33)
        #expect(ReaderSettings(web: ["tasbihTarget": 100_001]).tasbihTarget == 33)
        #expect(ReaderSettings(web: ["tasbihPreset": .string(String(repeating: "x", count: 101))]).tasbihPreset == nil)
    }

    @Test func readingAidsFollowTheLanguageUntilChosen() {
        #expect(ReaderSettings.resolve(nil, languageCode: "en"))
        #expect(!ReaderSettings.resolve(nil, languageCode: "ar"))
        #expect(ReaderSettings.resolve(true, languageCode: "ar"))
        #expect(!ReaderSettings.resolve(false, languageCode: "en"))
    }

    @Test func aPlaceIsRepairedOrDroppedAsTheWebsiteDoes() {
        #expect(SavedLocation(web: ["latitude": 91, "longitude": 0], deviceTimeZone: "UTC") == nil)
        #expect(SavedLocation(web: ["latitude": 10, "longitude": "5"], deviceTimeZone: "UTC") == nil)
        let repaired = SavedLocation(web: ["latitude": 10, "longitude": 5, "timeZone": "asia/tokyo", "countryCode": "sa", "source": "gps"], deviceTimeZone: "UTC")
        #expect(repaired?.timeZone == "Asia/Tokyo", "Intl takes a zone in any case; TimeZone needs its spelling")
        #expect(repaired?.countryCode == "SA" && repaired?.source == .gps && repaired?.label == "" && repaired?.updatedAt == 0)
        #expect(SavedLocation(web: ["latitude": 10, "longitude": 5, "timeZone": "Nowhere/Land"], deviceTimeZone: "Africa/Cairo")?.timeZone == "Africa/Cairo")
    }

    @Test func savedSettingsReadBackAsSaved() {
        let store = makeSettings()
        #expect(store.load() == SettingsSnapshot())
        var settings = SettingsSnapshot()
        settings.app = AppSettings(language: .ar, theme: .dark, timeFormat: .twentyFourHour, arabicDigits: false, hijriOffset: -1, name: "Fatima")
        settings.location = SavedLocation(latitude: 21.4225, longitude: 39.8262, timeZone: "Asia/Riyadh", label: "Makkah", countryCode: "SA", source: .gps, updatedAt: 1_788_084_000_000)
        settings.calculation = CalculationConfig(method: .fixed(.ummAlQura), madhab: .fixed(.hanafi), highLatitudeRule: .fixed(.seventhOfTheNight), polar: .nearestLatitude, adjustments: Adjustments(fajr: -2, isha: 30))
        settings.reminders.prayers = true
        settings.reminders.adhan = [.fajr]
        settings.reminders.ishaDeadline = .fajr
        settings.reader.arabicScale = 5
        settings.reader.showTranslation = false
        #expect(store.save(settings) == settings)
        #expect(store.load() == settings)
        #expect(store.timeZone() == TimeZone(identifier: "Asia/Riyadh"))
        #expect(Set(SettingsStore.Group.allCases.filter(store.has)) == Set(SettingsStore.Group.allCases))
    }

    @Test func savingMakesEverySettingValid() {
        let store = makeSettings()
        let saved = store.update {
            $0.app.hijriOffset = 9
            $0.app.name = "  \u{200F}Ali\n  "
            $0.reader.arabicScale = 0
            $0.reminders.unloggedLeadMinutes = 7
            $0.calculation.adjustments.fajr = 99
        }
        #expect(saved.app.hijriOffset == 2 && saved.app.name == "Ali")
        #expect(saved.reader.arabicScale == 3)
        #expect(saved.reminders.unloggedLeadMinutes == 15)
        #expect(saved.calculation.adjustments.fajr == 30)
    }

    @Test func anUpdateWritesOnlyTheGroupsItChanged() {
        let store = makeSettings()
        store.update { $0.app.theme = .light }
        #expect(store.has(.app))
        #expect(!store.has(.location) && !store.has(.calculation) && !store.has(.reminders) && !store.has(.reader))
        store.update { $0.location = nil }
        #expect(!store.has(.location))
    }

    @Test func aDamagedGroupCostsOnlyItsBadFields() {
        let store = makeSettings()
        store.defaults.set(Data(#"{"theme":"dark","hijriOffset":"two"}"#.utf8), forKey: "settings.app")
        store.defaults.set(Data("not json".utf8), forKey: "settings.reader")
        let loaded = store.load()
        #expect(loaded.app.theme == .dark && loaded.app.hijriOffset == 0)
        #expect(loaded.reader == ReaderSettings())
    }

    @Test(arguments: [
        (JSONValue.number(3), 3), (.number(0), 0), (.number(10), 10),
        // Out of range is clamped, as `hijriOffset`.
        (.number(11), 10), (.number(-1), 0), (.number(1e300), 10),
        // Anything else is no goal, and costs only this field.
        (.number(1.5), 0), (.string("2"), 0), (.bool(true), 0), (.null, 0), (.array([.number(2)]), 0),
    ])
    func theKhatmahGoalReadsLikeTheOffset(stored: JSONValue, goal: Int) {
        let settings = AppSettings(web: ["hijriOffset": 1, "ramadanKhatmahGoal": stored])
        #expect(settings.ramadanKhatmahGoal == goal)
        #expect(settings.hijriOffset == 1)
    }

    @Test func aMissingKhatmahGoalIsNoGoal() {
        #expect(AppSettings().ramadanKhatmahGoal == 0)
        #expect(AppSettings(web: nil).ramadanKhatmahGoal == 0)
        #expect(AppSettings(web: ["hijriOffset": 1]).ramadanKhatmahGoal == 0)
    }

    @Test func withoutAGoalTheSettingsAreExactlyWhatTheWebsiteWrites() {
        #expect(AppSettings().web["ramadanKhatmahGoal"] == nil)
        #expect(AppSettings(ramadanKhatmahGoal: 4).web["ramadanKhatmahGoal"] == 4)
    }

    @Test func savingKeepsTheKhatmahGoalInRange() {
        let store = makeSettings()
        #expect(store.update { $0.app.ramadanKhatmahGoal = 3 }.app.ramadanKhatmahGoal == 3)
        #expect(store.load().app.ramadanKhatmahGoal == 3)
        #expect(store.update { $0.app.ramadanKhatmahGoal = 11 }.app.ramadanKhatmahGoal == 10)
        #expect(store.update { $0.app.ramadanKhatmahGoal = -4 }.app.ramadanKhatmahGoal == 0)
        #expect(AppSettings(ramadanKhatmahGoal: 99).sanitized().ramadanKhatmahGoal == 10)
    }

    @Test func aDamagedKhatmahGoalCostsOnlyThatField() {
        let store = makeSettings()
        store.defaults.set(Data(#"{"theme":"dark","ramadanKhatmahGoal":"two"}"#.utf8), forKey: "settings.app")
        let loaded = store.load()
        #expect(loaded.app.theme == .dark && loaded.app.ramadanKhatmahGoal == 0)
    }

    @Test func theKhatmahGoalRoundTripsThroughABackup() async throws {
        var settings = SettingsSnapshot()
        settings.app.ramadanKhatmahGoal = 2
        let data = Backup.export(records: RecordsSnapshot(), settings: settings, at: instant("2026-10-29T08:00:00Z"))
        let read = try Backup.read(data, catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.settings.app.ramadanKhatmahGoal == 2)

        let store = makeSettings()
        try await Backup.restore(read, into: try makeStore(), settings: store)
        #expect(store.load().app.ramadanKhatmahGoal == 2)

        // Merging never touches settings the user has.
        let mine = makeSettings()
        mine.update { $0.app.ramadanKhatmahGoal = 5 }
        try await Backup.restore(read, into: try makeStore(), settings: mine, mode: .merge)
        #expect(mine.load().app.ramadanKhatmahGoal == 5)
    }

    @Test @MainActor func theModelShowsWhatWasSavedAndReadsInChangesMadeElsewhere() {
        let store = makeSettings()
        let model = SettingsModel(store: store)
        model.update { $0.app.timeFormat = .twentyFourHour }
        #expect(model.settings.app.timeFormat == .twentyFourHour)
        // A widget's App Intent saves through its own store on the same defaults.
        SettingsStore(defaults: store.defaults, postsNotifications: false).update { $0.reader.haptics = false }
        model.reload()
        #expect(!model.settings.reader.haptics)
        #expect(model.settings == store.load())
    }
}
