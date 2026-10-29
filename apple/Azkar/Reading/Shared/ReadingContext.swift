import AzkarKit
import Observation
import SwiftUI

/// What the Azkar tab reads and writes: the azkar dataset, the records and the settings.
/// Normally the app's own (`init(_:)`); a DEBUG demo can hand in another dataset and store.
@MainActor
@Observable
final class ReadingContext {
    let dataset: AzkarDataset
    let records: RecordsModel
    let settings: SettingsModel

    init(dataset: AzkarDataset, records: RecordsModel, settings: SettingsModel) {
        self.dataset = dataset
        self.records = records
        self.settings = settings
    }

    convenience init(_ app: AppEnvironment) {
        self.init(dataset: app.dataset, records: app.records, settings: app.settings)
    }

    var reader: ReaderSettings { settings.settings.reader }

    func updateReader(_ change: (inout ReaderSettings) -> Void) {
        settings.update { change(&$0.reader) }
    }

    /// Everything recorded on `day`.
    func day(_ day: DayKey) -> DayRecords { records.records.day(day) }

    /// The sessions the Azkar tab offers, in display order: morning, evening, bedtime when the
    /// dataset has it, then the after-prayer azkar of each prayer that has any.
    var dailySessions: [AzkarSession] {
        [.morning, .evening, .sleep].filter { !dataset.azkar(for: $0).isEmpty }
    }

    var afterPrayerSessions: [AzkarSession] {
        dataset.availableAfterPrayers.map(AzkarSession.afterPrayer)
    }
}
