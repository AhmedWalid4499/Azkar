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
    /// What the card in Wallet shows (its pass.json fields, as text), kept across launches so an
    /// unchanged refresh sends nothing.
    private var shown: String? {
        get { defaults.string(forKey: "wallet.shown") }
        set { defaults.set(newValue, forKey: "wallet.shown") }
    }
    @ObservationIgnored private var updating = false

    private let library = PKPassLibrary()

    private var defaults: UserDefaults { UserDefaults(suiteName: StoreContainer.appGroup) ?? .standard }

    /// Stable, so the card is replaced rather than added again. After a reinstall, the card already
    /// in Wallet gives it back.
    private var serialNumber: String {
        if let serial = defaults.string(forKey: "wallet.serial") { return serial }
        let inWallet = Self.config.flatMap { config in library.passes().first { $0.passTypeIdentifier == config.passType } }
        let serial = inWallet?.serialNumber ?? UUID().uuidString.lowercased()
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
        let content = await content(settings: settings, board: board)
        let pass = try await sign(content, ring: WalletCardContent.ring(board), qrText: WalletCardContent.qrText(settings))
        shown = content.text
        return pass
    }

    /// Replaces the card in Wallet when what it shows has changed. Nothing happens while the card
    /// is not in Wallet, without a place, or without the server.
    func update(settings: SettingsSnapshot, board: SystemPrayerBoard?) async {
        readState()
        guard isInWallet, let board, !updating else { return }
        updating = true
        defer { updating = false }
        let content = await content(settings: settings, board: board)
        guard content.text != shown else { return }
        do {
            let pass = try await sign(content, ring: WalletCardContent.ring(board), qrText: WalletCardContent.qrText(settings))
            if library.replacePass(with: pass) { shown = content.text }
        } catch {
            print("Azkar: the Wallet card was not updated: \(error)")
        }
    }

    /// The card in Wallet, to open it there.
    var passURL: URL? {
        guard let config = Self.config else { return nil }
        return library.pass(withPassTypeIdentifier: config.passType, serialNumber: serialNumber)?.passURL
    }

    private func content(settings: SettingsSnapshot, board: SystemPrayerBoard) async -> JSONValue {
        WalletCardContent.pass(board: board, language: SystemLanguage(settings.app), hijriOffset: settings.app.hijriOffset,
                               streak: await streak(today: board.rows.first?.day ?? board.today))
    }

    /// Days in a row with all five prayed, as the tracker counts them; `nil` when the records can't be read.
    private func streak(today: DayKey) async -> Int? {
        guard let store = try? SharedRecords.store(),
              let days = try? await store.days(from: today.adding(days: -3660), to: today) else { return nil }
        let history = Dictionary(days.map { ($0.day, $0.prayer) }, uniquingKeysWith: { first, _ in first })
        return PrayerStats.streaks(history, today: today).current
    }

    private func sign(_ content: JSONValue, ring: String, qrText: String) async throws -> PKPass {
        guard let config = Self.config else { throw Failure.notConfigured }
        var request = URLRequest(url: config.server.appending(path: "v1/pass"))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(config.key, forHTTPHeaderField: "x-azkar-key")
        let body: JSONValue = ["serialNumber": .string(serialNumber), "pass": content, "ring": .string(ring), "qrText": .string(qrText)]
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
///
/// Laid out like the app icon: green, with cream text and gold labels. The top line has the date
/// in both calendars; then "Prayed today" beside a ring with a gold segment for each prayer prayed
/// (drawn by the server from `ring(_:)`); then the five prayers with their times, three and three
/// with the streak, in columns.
nonisolated enum WalletCardContent {
    static let background = "rgb(14, 107, 84)"
    static let foreground = "rgb(250, 244, 230)"
    static let label = "rgb(232, 200, 128)"

    static func pass(board: SystemPrayerBoard, language: SystemLanguage, hijriOffset: Int, streak: Int?) -> JSONValue {
        let day = board.rows.first?.day ?? board.today
        let zone = board.place.timeZone
        let prayed = board.rows.filter { $0.status.map(isPrayed) ?? false }.count
        let due = board.rows.filter { $0.status != .excused }.count
        let prayers: [JSONValue] = board.rows.enumerated().map { index, row in
            let time = row.at.map { SystemText.time($0, in: zone, language) } ?? "—"
            let value = row.status.map { "\(mark($0)) \(time)" } ?? time
            // The middle column is centred, so the two rows line up as a table.
            return field(row.prayer.rawValue, SystemText.prayer(row.prayer, language, on: row.day), value,
                         alignment: index % 3 == 1 ? "PKTextAlignmentCenter" : nil)
        }
        var lower = Array(prayers.dropFirst(3))
        if let streak {
            // "—" before the first full day: in Arabic a lone zero (٠) is only a dot.
            lower.append(field("streak", SystemText.string("Streak", language), streak > 0 ? days(streak, language) : "—"))
        }

        var back: [JSONValue] = []
        let statuses = board.rows.map { row in
            let name = SystemText.prayer(row.prayer, language, on: row.day)
            let time = row.at.map { SystemText.time($0, in: zone, language) } ?? "—"
            let status = row.status.map { SystemText.status($0, language) } ?? SystemText.string("Not logged", language)
            return [name, time, status].joined(separator: SystemText.separator(language))
        }
        back.append(field("today", SystemText.shortDay(day, language), statuses.joined(separator: "\n")))
        if !board.placeName.isEmpty {
            back.append(field("place", SystemText.string("Prayer times for", language), board.placeName))
        }
        back.append(field("how", SystemText.string("Logging prayers", language),
                          SystemText.string("Log your prayers in Azkar and this card updates. Prayers ticked from a widget appear here the next time you open Azkar.", language)))

        var pass: [String: JSONValue] = [
            "description": .string(SystemText.string("Today’s prayers", language)),
            // The app's name, as on the Home Screen of each language.
            "logoText": .string(language.isArabic ? "أذكار" : "Azkar"),
            "backgroundColor": .string(background),
            "foregroundColor": .string(foreground),
            "labelColor": .string(label),
            "generic": [
                "headerFields": [field("hijri", SystemText.shortDay(day, language), SystemText.hijriDay(day, offset: hijriOffset, language),
                                       alignment: "PKTextAlignmentRight")],
                "primaryFields": [field("prayed", SystemText.string("Prayed today", language),
                                        SystemText.format("%1$@ of %2$@", language, SystemText.number(prayed, language), SystemText.number(due, language)))],
                "secondaryFields": .array(Array(prayers.prefix(3))),
                "auxiliaryFields": .array(lower),
                "backFields": .array(back),
            ],
        ]
        // Wallet can bring the card forward around the next prayer.
        if let next = board.next {
            pass["relevantDate"] = .string(next.at.formatted(.iso8601))
        }
        return .object(pass)
    }

    /// Under the QR code at the bottom of the card, which leads to the app's page (added by the server).
    static func qrText(_ settings: SettingsSnapshot) -> String {
        SystemText.string("Scan to get Azkar", SystemLanguage(settings.app))
    }

    /// The ring beside "Prayed today": "1" for each prayer prayed, Fajr first ("10110").
    static func ring(_ board: SystemPrayerBoard) -> String {
        String(board.rows.map { $0.status.map(isPrayed) == true ? "1" : "0" })
    }

    private static func isPrayed(_ status: PrayerStatus) -> Bool {
        switch status {
        case .ontime, .jamaah, .late: true
        case .missed, .excused: false
        }
    }

    /// Before the time: ✓ prayed, ✕ missed, – excused.
    private static func mark(_ status: PrayerStatus) -> String {
        switch status {
        case .ontime, .jamaah, .late: "✓"
        case .missed: "✕"
        case .excused: "–"
        }
    }

    /// "12 days", in the card's language and digits.
    static func days(_ count: Int, _ language: SystemLanguage) -> String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.day]
        formatter.unitsStyle = .full
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = language.locale
        formatter.calendar = calendar
        return formatter.string(from: DateComponents(day: count)) ?? SystemText.number(count, language)
    }

    private static func field(_ key: String, _ label: String, _ value: String, alignment: String? = nil) -> JSONValue {
        var field: [String: JSONValue] = ["key": .string(key), "label": .string(label), "value": .string(value)]
        if let alignment { field["textAlignment"] = .string(alignment) }
        return .object(field)
    }
}
