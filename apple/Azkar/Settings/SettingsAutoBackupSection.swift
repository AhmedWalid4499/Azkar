import AzkarKit
import SwiftUI
import UniformTypeIdentifiers

/// Automatic backup: the folder it writes to and when it last did.
struct SettingsAutoBackupSection: View {
    @State private var backup = AutoBackup.shared
    @State private var choosing = false

    var body: some View {
        Section {
            if let folder = backup.folderName {
                LabeledContent {
                    Text(verbatim: folder).lineLimit(1)
                } label: {
                    Label { Text("Folder", tableName: SettingsText.table) } icon: { Image(systemName: "folder") }
                }
                LabeledContent {
                    if let last = backup.lastBackupAt {
                        Text(last, format: .dateTime.day().month().hour().minute())
                    } else {
                        Text("Not yet", tableName: SettingsText.table)
                    }
                } label: {
                    Label { Text("Last backup", tableName: SettingsText.table) } icon: { Image(systemName: "checkmark.icloud") }
                }
                Button {
                    Task { await backup.backUp(evenIfUnchanged: true) }
                } label: {
                    Label { Text("Back up now", tableName: SettingsText.table) } icon: { Image(systemName: "arrow.clockwise") }
                }
                .disabled(backup.isRunning)
                Button {
                    choosing = true
                } label: {
                    Label { Text("Change folder", tableName: SettingsText.table) } icon: { Image(systemName: "folder.badge.gearshape") }
                }
                Button(role: .destructive) {
                    backup.turnOff()
                } label: {
                    Label { Text("Turn off automatic backup", tableName: SettingsText.table) } icon: { Image(systemName: "xmark.circle") }
                }
            } else {
                Button {
                    choosing = true
                } label: {
                    Label { Text("Choose a folder", tableName: SettingsText.table) } icon: { Image(systemName: "folder.badge.plus") }
                }
            }
        } header: {
            Text("Automatic backup", tableName: SettingsText.table)
        } footer: {
            VStack(alignment: .leading, spacing: 6) {
                if backup.hasFailed {
                    Text("The last backup couldn’t be saved. If this keeps happening, choose the folder again.", tableName: SettingsText.table)
                        .foregroundStyle(.red)
                }
                Text("Azkar saves a copy of everything to this folder whenever it changes: one file a day, the latest 30. Choose a folder in iCloud Drive so your records survive losing this iPhone. Restore one with “Restore a backup”.", tableName: SettingsText.table)
            }
        }
        .sheet(isPresented: $choosing) {
            BackupFolderPicker { url in
                Task { await backup.choose(url) }
            }
            .ignoresSafeArea()
        }
    }
}

/// The system's folder picker.
private struct BackupFolderPicker: UIViewControllerRepresentable {
    let onPick: (URL) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (URL) -> Void

        init(onPick: @escaping (URL) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            if let url = urls.first { onPick(url) }
        }
    }
}
