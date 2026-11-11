import AzkarKit
import PassKit
import SwiftUI

/// Adds the "Today's prayers" card to Apple Wallet, or says it is there. Absent until the Wallet
/// server is set up, and on iPhones that can't add passes.
struct SettingsWalletSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @Environment(\.openURL) private var openURL
    @State private var pass: PKPass?
    @State private var failed = false
    @State private var noPlace = false
    private var card: WalletCard { .shared }

    var body: some View {
        if card.isAvailable {
            Section {
                if card.isInWallet {
                    Label {
                        Text("The card is in Wallet", tableName: SettingsText.table)
                    } icon: {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                    }
                    if let url = card.passURL {
                        Button {
                            openURL(url)
                        } label: {
                            Label { Text("Show in Wallet", tableName: SettingsText.table) } icon: { Image(systemName: "wallet.pass") }
                        }
                    }
                } else if let pass {
                    AddPassToWalletButton([pass]) { added in
                        guard added else { return }
                        card.readState()
                        // Brings it up to date if anything was logged while the sheet was open.
                        Task { await SystemServices.shared.refresh(reason: "wallet added") }
                    }
                    .addPassToWalletButtonStyle(.black)
                    .frame(height: 50)
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                } else if noPlace {
                    Text("Choose your location first, then add the card.", tableName: SettingsText.table)
                        .foregroundStyle(.secondary)
                } else if failed {
                    Button {
                        Task { await prepare() }
                    } label: {
                        Text("Couldn’t prepare the card. Try again", tableName: SettingsText.table)
                    }
                } else {
                    HStack {
                        ProgressView()
                        Text("Preparing the card…", tableName: SettingsText.table).foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Apple Wallet", tableName: SettingsText.table)
            } footer: {
                Text("A card with today’s date and your five prayers, ticked as you log them. It updates when you log a prayer in Azkar and when you open the app.", tableName: SettingsText.table)
            }
            .task(id: app.settings.settings.location) { await prepare() }
        }
    }

    private func prepare() async {
        card.readState()
        guard !card.isInWallet else { return }
        failed = false
        let (settings, board) = await SystemServices.shared.currentBoard()
        noPlace = board == nil
        guard let board else { return }
        do {
            pass = try await card.makePass(settings: settings, board: board)
        } catch {
            failed = true
        }
    }
}
