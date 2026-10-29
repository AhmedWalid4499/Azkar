import AzkarKit
import Observation
import SwiftUI

/// Everything the screens share: the azkar dataset, the user's settings and records, each
/// observable and kept in step with what widgets and App Intents save in other processes.
/// Created once by `AzkarApp` and handed down with `.environment(_:)`.
@MainActor
@Observable
final class AppEnvironment {
    let dataset: AzkarDataset
    let settingsStore: SettingsStore
    let store: RecordStore
    let settings: SettingsModel
    let records: RecordsModel
    /// What was brought over from the web-based app on this phone, once it has run.
    private(set) var importReport: ImportReport?

    init(location: StoreLocation = .shared, settingsStore: SettingsStore = .shared()) throws {
        let dataset = AzkarDataset.bundled
        self.dataset = dataset
        self.settingsStore = settingsStore
        let store = try RecordStore.open(location, catalog: DatasetCatalog(dataset), timeZone: { settingsStore.timeZone() })
        self.store = store
        settings = SettingsModel(store: settingsStore)
        records = RecordsModel(store: store)
    }

    /// Imports the web-based app's data once, then follows changes for as long as the app runs.
    /// Call from the root view's `.task`.
    func run() async {
        do {
            importReport = try await WebDataImport.runIfNeeded(into: store, settings: settingsStore)
            settings.reload()
        } catch {
            // Tried again at the next launch; the import never removes its source.
            print("Azkar: importing the web app's data failed: \(error)")
        }
        await records.reload()
        async let followRecords: Void = records.run()
        async let followSettings: Void = settings.run()
        _ = await (followRecords, followSettings)
    }
}
