import SwiftUI

/// Setting up the companion: what it is, what it costs, where what you write goes, and the key.
struct CompanionKeyForm: View {
    let onSaved: () -> Void
    @State private var key = ""
    @State private var hasKey = CompanionKey.load() != nil
    @State private var failed = false

    private static let console = URL(string: "https://console.anthropic.com/settings/keys")!

    var body: some View {
        Form {
            Section {
                Text(CL("The companion uses Claude, an AI made by Anthropic. It needs an API key from your own Anthropic account, and what it costs is billed there: usually a few cents a conversation, rarely more than 20 cents."))
                Link(destination: Self.console) {
                    Label { Text(CL("Create a key in the Anthropic Console")) } icon: { Image(systemName: "arrow.up.forward.square") }
                }
            }

            Section {
                SecureField(text: $key) {
                    Text(hasKey ? CL("Paste a new key to replace it") : CL("Paste your API key"))
                }
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                Button {
                    if CompanionKey.save(key) {
                        key = ""
                        hasKey = true
                        failed = false
                        onSaved()
                    } else {
                        failed = true
                    }
                } label: {
                    Text(CL("Save key"))
                }
                .disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } header: {
                Text(CL("API key"))
            } footer: {
                if failed {
                    Text(CL("The key couldn’t be saved. Try again."))
                } else if hasKey {
                    Text(CL("A key is saved. It stays in this iPhone’s Keychain and is never in your backups."))
                } else {
                    Text(CL("It stays in this iPhone’s Keychain and is never in your backups."))
                }
            }

            Section {
                Text(CL("What you write to the companion is sent to Anthropic to get a reply. Your conversations are saved on this iPhone and in your backups, and left out of the spreadsheet export."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if hasKey {
                    Button(role: .destructive) {
                        CompanionKey.remove()
                        hasKey = false
                    } label: {
                        Text(CL("Remove key"))
                    }
                }
            } header: {
                Text(CL("Privacy"))
            }
        }
        .navigationTitle(Text(CL("Companion")))
        .navigationBarTitleDisplayMode(.inline)
    }
}
