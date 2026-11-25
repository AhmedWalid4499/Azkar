import AzkarKit
import SwiftUI

/// Backups in the user's own iCloud Drive: on by default, when they were last saved, and restoring one.
struct SettingsICloudSection: View {
    @State private var backup = AutoBackup.shared

    var body: some View {
        Section {
            // Off, and not to be turned on, while there is no iCloud to save to.
            Toggle(isOn: Binding(get: { backup.iCloudAvailable && backup.iCloudOn }, set: { backup.iCloudOn = $0 })) {
                Label { Text("Save to iCloud", tableName: SettingsText.table) } icon: { Image(systemName: "icloud") }
            }
            .disabled(!backup.iCloudAvailable)
            if backup.iCloudAvailable, backup.iCloudOn {
                LabeledContent {
                    if let last = backup.iCloudLastBackupAt {
                        Text(last, format: .dateTime.day().month().hour().minute())
                    } else {
                        Text("Not yet", tableName: SettingsText.table)
                    }
                } label: {
                    Label { Text("Saved to iCloud", tableName: SettingsText.table) } icon: { Image(systemName: "checkmark.icloud") }
                }
            }
            if backup.iCloudAvailable {
                NavigationLink {
                    SettingsICloudRestoreView()
                } label: {
                    Label { Text("Restore from iCloud", tableName: SettingsText.table) } icon: { Image(systemName: "icloud.and.arrow.down") }
                }
            }
        } header: {
            Text("iCloud", tableName: SettingsText.table)
        } footer: {
            VStack(alignment: .leading, spacing: 6) {
                if !backup.iCloudAvailable {
                    Text("To keep your records in iCloud, sign in to iCloud and turn on iCloud Drive in the Settings app.", tableName: SettingsText.table)
                } else if backup.iCloudOn, backup.iCloudHasFailed {
                    Text("The last iCloud backup couldn’t be saved. Azkar will try again.", tableName: SettingsText.table)
                        .foregroundStyle(.red)
                }
                Text("Azkar saves a copy of everything to your iCloud Drive whenever it changes: one file a day, the latest 30, in iCloud Drive › Azkar › Backups. Only you can see it.", tableName: SettingsText.table)
            }
        }
    }
}

/// The backups in iCloud by date, newest first. Choosing one asks how to restore it, as a file does.
struct SettingsICloudRestoreView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var names: [String]?
    @State private var opening: String?
    @State private var pending: Backup.Contents?
    @State private var pendingName: String?
    @State private var outcome: Outcome?

    enum Outcome: Identifiable {
        case restored(ImportReport)
        case failed(String)

        var id: String {
            switch self {
            case .restored: "restored"
            case let .failed(message): message
            }
        }
    }

    var body: some View {
        List {
            if let names {
                if names.isEmpty {
                    ContentUnavailableView {
                        Label { Text("No backups in iCloud yet", tableName: SettingsText.table) } icon: { Image(systemName: "icloud") }
                    } description: {
                        Text("Azkar saves one when your records change and you leave the app.", tableName: SettingsText.table)
                    }
                } else {
                    Section {
                        ForEach(names, id: \.self) { name in
                            Button {
                                Task { await open(name) }
                            } label: {
                                HStack {
                                    Label { Text(verbatim: title(of: name)) } icon: { Image(systemName: "doc.text") }
                                    Spacer(minLength: 8)
                                    if opening == name { ProgressView() }
                                }
                            }
                            .foregroundStyle(.primary)
                            .disabled(opening != nil)
                        }
                    } footer: {
                        Text("Each is a full copy of your records and settings on that day.", tableName: SettingsText.table)
                    }
                }
            } else {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }
        }
        .navigationTitle(Text("Restore from iCloud", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
        .task { names = await ICloudBackups.list() }
        .refreshable { names = await ICloudBackups.list() }
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
            case let .failed(message):
                Alert(title: Text("Nothing was changed", tableName: SettingsText.table), message: Text(message))
            }
        }
        .sensoryFeedback(trigger: outcome?.id) { _, _ in
            switch outcome {
            case .failed: .error
            case .restored: .success
            case nil: nil
            }
        }
    }

    /// "16 November 2026", from the day in the name.
    private func title(of name: String) -> String {
        guard let day = BackupFolder.day(of: name) else { return name }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        return day.noonUTC.formatted(Date.FormatStyle(date: .long, time: .omitted, locale: locale, calendar: calendar, timeZone: .gmt))
    }

    private func open(_ name: String) async {
        opening = name
        defer { opening = nil }
        do {
            pending = try await ICloudBackups.read(name, catalog: app.store.catalog)
            pendingName = name
        } catch is Backup.Failure {
            outcome = .failed(SettingsText.string("That file is not an Azkar backup.", locale: locale))
        } catch {
            outcome = .failed(SettingsText.string("The backup couldn’t be downloaded from iCloud. Check your connection and try again.", locale: locale))
        }
    }

    private func restore(_ contents: Backup.Contents, mode: Backup.Mode) async {
        do {
            let report = try await SettingsBackupImport.restore(contents, mode: mode, app: app)
            if let pendingName { AutoBackup.shared.restored(fromICloud: pendingName) }
            outcome = .restored(report)
        } catch {
            outcome = .failed(SettingsText.string("The backup couldn’t be saved, so nothing was changed. This iPhone’s storage may be full.", locale: locale))
        }
    }
}
