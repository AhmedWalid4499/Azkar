import AzkarKit
import Foundation
import PassKit

/// The "Today's prayers" card in Apple Wallet: today's date in both calendars, how many prayers are
/// logged, and each prayer's time with a tick once prayed.
///
/// The app writes the card's content, in its own language; the Azkar Wallet server
/// (`wallet-server/`) signs it, since the signing key must never ship in the app. Once the card is in
/// Wallet, every refresh that changes what it shows (a prayer logged, a new day, another language)
/// replaces it with a fresh one. The card is read-only: prayers are ticked in the app or its widgets.
@MainActor
@Observable
final class WalletCard {
    static let shared = WalletCard()

    /// The server and pass type, from Info.plist. `nil` until the server is set up: the card is
    /// then not offered at all.
    struct Config {
        let server: URL
        let key: String
        let passType: String
    }

    nonisolated static let config: Config? = {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let address = info["AzkarWalletServer"] as? String, let server = URL(string: address), server.scheme == "https",
              let key = info["AzkarWalletKey"] as? String, !key.isEmpty,
              let passType = info["AzkarWalletPassType"] as? String, !passType.isEmpty else { return nil }
        return Config(server: server, key: key, passType: passType)
    }()

    enum Failure: Error {
        case notConfigured
        case server(Int)
        case notAPass
    }

    /// Whether the card can be offered on this iPhone.
    var isAvailable: Bool { Self.config != nil && PKAddPassesViewController.canAddPasses() }
    private(set) var isInWallet = false
    /// What the card in Wallet shows, so an unchanged refresh sends nothing.
    @ObservationIgnored private var shown: JSONValue?
    @ObservationIgnored private var updating = false

    private let library = PKPassLibrary()

    /// Stable for this install, so the card is replaced rather than added again.
    private var serialNumber: String {
        let defaults = UserDefaults(suiteName: StoreContainer.appGroup) ?? .standard
        if let serial = defaults.string(forKey: "wallet.serial") { return serial }
        let serial = UUID().uuidString.lowercased()
        defaults.set(serial, forKey: "wallet.serial")
        return serial
    }

    /// Reads whether the card is in Wallet (the user can remove it there at any time).
    func readState() {
        guard let config = Self.config else { return }
        isInWallet = library.pass(withPassTypeIdentifier: config.passType, serialNumber: serialNumber) != nil
    }

    /// A freshly signed card for now, to add to Wallet.
    func makePass(settings: SettingsSnapshot, board: SystemPrayerBoard) async throws -> PKPass {
        let content = WalletCardContent.pass(board: board, language: SystemLanguage(settings.app), hijriOffset: settings.app.hijriOffset)
        let pass = try await sign(content)
        shown = content
        return pass
    }

    /// Replaces the card in Wallet when what it shows has changed. Nothing happens while the card
    /// is not in Wallet, without a place, or without the server.
    func update(settings: SettingsSnapshot, board: SystemPrayerBoard?) async {
        readState()
        guard isInWallet, let board, !updating else { return }
        let content = WalletCardContent.pass(board: board, language: SystemLanguage(settings.app), hijriOffset: settings.app.hijriOffset)
        guard content != shown else { return }
        updating = true
        defer { updating = false }
        do {
            let pass = try await sign(content)
            if library.replacePass(with: pass) { shown = content }
        } catch {
            print("Azkar: the Wallet card was not updated: \(error)")
        }
    }

    private func sign(_ content: JSONValue) async throws -> PKPass {
        guard let config = Self.config else { throw Failure.notConfigured }
        var request = URLRequest(url: config.server.appending(path: "v1/pass"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(config.key, forHTTPHeaderField: "x-azkar-key")
        let body: JSONValue = ["serialNumber": .string(serialNumber), "pass": content]
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { throw Failure.server(status) }
        do {
            return try PKPass(data: data)
        } catch {
            throw Failure.notAPass
        }
    }
}

/// The card's pass.json fields, without the identity and signing ones the server adds.
nonisolated enum WalletCardContent {
    static let background = "rgb(14, 107, 84)"
    static let foreground = "rgb(255, 255, 255)"
    static let label = "rgb(196, 232, 220)"

    static func pass(board: SystemPrayerBoard, language: SystemLanguage, hijriOffset: Int) -> JSONValue {
        let day = board.rows.first?.day ?? board.today
        let zone = board.place.timeZone
        let logged = board.rows.filter(\.isLogged).count
        let prayers: [JSONValue] = board.rows.map { row in
            let time = row.at.map { SystemText.time($0, in: zone, language) } ?? "—"
            return field(row.prayer.rawValue, SystemText.prayer(row.prayer, language, on: row.day), row.isLogged ? "✓ \(time)" : time)
        }
        var back: [JSONValue] = []
        if !board.placeName.isEmpty {
            back.append(field("place", SystemText.string("Prayer times for", language), board.placeName))
        }
        back.append(field("how", SystemText.string("Logging prayers", language),
                          SystemText.string("Tick each prayer in Azkar or its widgets. This card updates when you do, and each new day.", language)))
        var pass: [String: JSONValue] = [
            "description": .string(SystemText.string("Today’s prayers", language)),
            // The app's name, as on the Home Screen of each language.
            "logoText": .string(language.isArabic ? "أذكار" : "Azkar"),
            "backgroundColor": .string(background),
            "foregroundColor": .string(foreground),
            "labelColor": .string(label),
            "generic": [
                "headerFields": [field("hijri", SystemText.shortDay(day, language), SystemText.hijriDay(day, offset: hijriOffset, language))],
                "primaryFields": [field("prayed", SystemText.string("Prayed today", language),
                                        SystemText.format("%1$@ of %2$@", language, SystemText.number(logged, language), SystemText.number(board.rows.count, language)))],
                "secondaryFields": .array(Array(prayers.prefix(3))),
                "auxiliaryFields": .array(Array(prayers.dropFirst(3))),
                "backFields": .array(back),
            ],
        ]
        // Wallet can bring the card forward around the next prayer.
        if let next = board.next {
            pass["relevantDate"] = .string(next.at.formatted(.iso8601))
        }
        return .object(pass)
    }

    private static func field(_ key: String, _ label: String, _ value: String) -> JSONValue {
        ["key": .string(key), "label": .string(label), "value": .string(value)]
    }
}
