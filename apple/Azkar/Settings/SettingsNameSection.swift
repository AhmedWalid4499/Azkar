import AzkarKit
import SwiftUI

/// What the app calls the user. Saved as it is typed, cleaned by `AppSettings.sanitizeName`
/// (one line, no invisible characters, at most 40 characters); the cleaned name is shown again
/// when editing ends.
struct SettingsNameSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var draft = ""
    @FocusState private var editing: Bool

    private var saved: String { app.settings.settings.app.name }

    var body: some View {
        Section {
            TextField(text: $draft, prompt: Text(SettingsText.string("e.g. Ahmed", locale: locale))) {
                Text("Your name", tableName: SettingsText.table)
            }
            .textContentType(.givenName)
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .submitLabel(.done)
            .focused($editing)
            .onSubmit { draft = saved }
        } header: {
            Text("Your name", tableName: SettingsText.table)
        } footer: {
            Text("Used to greet you and in your reminders. It stays on this iPhone.", tableName: SettingsText.table)
        }
        .onAppear { draft = saved }
        .onChange(of: draft) { _, text in
            if AppSettings.sanitizeName(text) != saved {
                app.settings.update { $0.app.name = text }
            }
        }
        .onChange(of: editing) { _, isEditing in
            if !isEditing { draft = saved }
        }
        .onChange(of: saved) { _, name in
            if !editing { draft = name }
        }
    }
}
