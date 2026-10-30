import AzkarCore

// AzkarStore: the user's records and settings on the device.
//
//   Records/   SwiftData rows (`AzkarSchemaV3` + `AzkarMigrationPlan`), the `RecordStore` actor that
//              owns every read and write, and `RecordsModel`, its main-actor face for SwiftUI.
//   Settings/  `SettingsStore` (App Group UserDefaults) and `SettingsModel` for SwiftUI.
//   Web/       The website's stored formats: its validation rules, read and written exactly as
//              its zustand stores do, so a backup or the web-based app's data reads the same here.
//   Transfer/  `WebDataImport`, the one-time import of the web-based app's data, and `Backup`,
//              backup files in the website's format.
//
// Records are filed under `DayKey`s; times are whole milliseconds, as the website keeps them.
// Changes are announced across processes with `StoreNotifications`.
