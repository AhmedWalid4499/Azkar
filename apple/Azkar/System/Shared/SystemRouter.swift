import AzkarKit
import Foundation
import Observation

/// A place in the app that the system can open: from a notification, a widget, a control, the
/// Live Activity or Siri.
nonisolated enum SystemRoute: Hashable, Sendable {
    /// The Today tab.
    case today
    /// The reader, open at a session.
    case azkar(AzkarSession)
    /// The Qibla tab.
    case qibla
    /// The mushaf, open where reading goes on.
    case quran

    static let scheme = "azkar"

    /// `azkar://today`, `azkar://azkar/morning`, `azkar://azkar/afterPrayer:asr`, `azkar://qibla`, `azkar://quran`.
    var url: URL {
        switch self {
        case .today: URL(string: "\(Self.scheme)://today")!
        case let .azkar(session): URL(string: "\(Self.scheme)://azkar/\(session.description)")!
        case .qibla: URL(string: "\(Self.scheme)://qibla")!
        case .quran: URL(string: "\(Self.scheme)://quran")!
        }
    }

    init?(url: URL) {
        guard url.scheme == Self.scheme else { return nil }
        switch url.host() {
        case "today": self = .today
        case "qibla": self = .qibla
        case "quran": self = .quran
        case "azkar":
            guard let key = url.pathComponents.dropFirst().first, let session = AzkarSession(key) else { return nil }
            self = .azkar(session)
        default: return nil
        }
    }
}

/// Where the system asks the app to go. The root view shows `pending` and then clears it:
///
/// ```swift
/// .onOpenURL { SystemRouter.shared.open($0) }
/// .onChange(of: SystemRouter.shared.pending, initial: true) { _, route in
///     guard let route = SystemRouter.shared.take() else { return }
///     // select the tab, open the session…
/// }
/// ```
@MainActor
@Observable
final class SystemRouter {
    static let shared = SystemRouter()

    /// The latest request not yet shown.
    private(set) var pending: SystemRoute?
    /// The Quran tab should open the mushaf, which it can only do once its text has loaded.
    var opensQuranReader = false

    func go(_ route: SystemRoute) { pending = route }

    /// Handles an `azkar://` URL from a widget or the Live Activity; false for any other URL.
    @discardableResult
    func open(_ url: URL) -> Bool {
        guard let route = SystemRoute(url: url) else { return false }
        go(route)
        return true
    }

    /// The pending route, cleared.
    func take() -> SystemRoute? {
        defer { pending = nil }
        return pending
    }
}
