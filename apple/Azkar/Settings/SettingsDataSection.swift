import AzkarKit
import SwiftUI
import UniformTypeIdentifiers

/// The user's data: a backup in the website's format to save or send, restoring one, what was
/// brought over from the earlier app, and erasing everything.
struct SettingsDataSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    @State private var importing = false
    @State private var pending: Backup.Contents?
    @State private var outcome: Outcome?
    @State private var confirmingErase = false
    @State private var confirmingEraseAgain = false
    @State private var importReports: [ImportReport] = []

    enum Outcome: Identifiable {
        case restored(ImportReport)
        case erased
        case failed(String)

        var id: String {
            switch self {
            case .restored: "restored"
            case .erased: "erased"
            case let .failed(message): message
            }
        }
    }

    var body: some View {
        Section {
            ShareLink(
                item: SettingsBackupFile(records: app.records.records, settings: app.settings.settings, fileName: fileName),
                preview: SharePreview(fileName, image: Image(systemName: "doc.text"))
            ) {
                Label { Text("Export a backup", tableName: SettingsText.table) } icon: { Image(systemName: "square.and.arrow.up") }
            }
            .disabled(!app.records.isLoaded)

            Button {
                importing = true
            } label: {
                Label { Text("Restore a backup", tableName: SettingsText.table) } icon: { Image(systemName: "square.and.arrow.down") }
            }
            .task(id: app.importReport) { await loadReports() }
            #if DEBUG
            .task {
                // `-AzkarDemoRestore <path>` reads that backup and asks how to restore it; `-AzkarDemoErase YES` asks to erase.
                try? await Task.sleep(for: .milliseconds(800))
                let arguments = UserDefaults.standard
                if let path = arguments.string(forKey: "AzkarDemoRestore") {
                    pending = try? SettingsBackupImport.read(URL(filePath: path), catalog: app.store.catalog)
                    // `-AzkarDemoRestoreMode replace|merge` answers the question too.
                    if let contents = pending, let mode = arguments.string(forKey: "AzkarDemoRestoreMode") {
                        await restore(contents, mode: mode == "merge" ? .merge : .replace)
                    }
                }
                if arguments.bool(forKey: "AzkarDemoErase") { confirmingErase = true }
                if arguments.bool(forKey: "AzkarDemoEraseNow") { await erase() }
            }
            #endif
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                guard case let .success(url) = result else { return }
                do throws(SettingsBackupImport.Failure) {
                    pending = try SettingsBackupImport.read(url, catalog: app.store.catalog)
                } catch .notABackup {
                    outcome = .failed(SettingsText.string("That file is not an Azkar backup.", locale: locale))
                } catch {
                    outcome = .failed(SettingsText.string("The file couldn’t be read.", locale: locale))
                }
            }
            .restoreBackupDialog($pending) { contents, mode in
                Task { await restore(contents, mode: mode) }
            }
            .alert(item: $outcome) { outcome in
                switch outcome {
                case let .restored(report):
                    Alert(
                        title: Text("Backup restored", tableName: SettingsText.table),
                        message: Text(SettingsImportSummary.counts(report, locale: locale))
                    )
                case .erased:
                    Alert(title: Text("All data erased", tableName: SettingsText.table))
                case let .failed(message):
                    Alert(title: Text("Nothing was changed", tableName: SettingsText.table), message: Text(message))
                }
            }
            .sensoryFeedback(trigger: outcome?.id) { _, id in
                switch outcome {
                case .failed: .error
                case .some: .success
                case nil: nil
                }
            }

            if importReports.contains(where: { !$0.isEmpty }) {
                NavigationLink(value: SettingsPage.imported) {
                    Label { Text("Imported data", tableName: SettingsText.table) } icon: { Image(systemName: "clock.arrow.circlepath") }
                }
            }

            Button(role: .destructive) {
                confirmingErase = true
            } label: {
                Label { Text("Erase all data", tableName: SettingsText.table) } icon: { Image(systemName: "trash") }
            }
            .confirmationDialog(
                Text("Erase all your data?", tableName: SettingsText.table),
                isPresented: $confirmingErase,
                titleVisibility: .visible
            ) {
                Button(role: .destructive) {
                    confirmingEraseAgain = true
                } label: {
                    Text("Erase all data", tableName: SettingsText.table)
                }
            } message: {
                Text("This permanently removes your prayer log, azkar progress, tasbih counts, fasts, location and settings from this iPhone. Export a backup first if you might want them again.", tableName: SettingsText.table)
            }
            .alert(
                Text("Are you sure?", tableName: SettingsText.table),
                isPresented: $confirmingEraseAgain
            ) {
                Button(role: .destructive) {
                    Task { await erase() }
                } label: {
                    Text("Erase everything", tableName: SettingsText.table)
                }
                Button(role: .cancel) {} label: {
                    Text("Keep my data", tableName: SettingsText.table)
                }
            } message: {
                Text("Everything Azkar has recorded on this iPhone will be gone. This can’t be undone.", tableName: SettingsText.table)
            }
        } header: {
            Text("Your data", tableName: SettingsText.table)
        } footer: {
            Text("Your prayer log, progress and settings are kept on this iPhone, inside the app. With “Save to iCloud” on, a copy is also kept in your iCloud, so removing the app or changing phones loses nothing. You can also export a backup, which opens in the Azkar website too.", tableName: SettingsText.table)
        }
    }

    private var fileName: String {
        Backup.fileName(in: app.settings.settings.timeZone)
    }

    private func restore(_ contents: Backup.Contents, mode: Backup.Mode) async {
        pending = nil
        do {
            let report = try await SettingsBackupImport.restore(contents, mode: mode, app: app)
            await loadReports()
            outcome = .restored(report)
        } catch {
            outcome = .failed(SettingsText.string("The backup couldn’t be saved, so nothing was changed. This iPhone’s storage may be full.", locale: locale))
        }
    }

    /// Every record and every setting goes; the note of what was imported from the earlier app
    /// stays, so its data is not brought back at the next launch.
    private func erase() async {
        do {
            try await app.store.replaceAll(with: RecordsSnapshot())
            app.settingsStore.save(SettingsSnapshot())
            app.settings.reload()
            await app.records.reload()
            outcome = .erased
        } catch {
            outcome = .failed(SettingsText.string("Your data couldn’t be erased. Try again.", locale: locale))
        }
    }

    private func loadReports() async {
        importReports = (try? await app.store.importReports()) ?? []
    }
}
