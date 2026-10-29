import AzkarKit
import Foundation
import Observation

/// Where Today asks the rest of the app to go. Today never presents the reader itself (the
/// Azkar tab owns it); it files a request here and whoever owns navigation carries it out.
///
/// For the integrator, in `RootView`:
/// ```swift
/// @State private var tab = ...
/// let navigation = TodayNavigation.shared
/// TabView(selection: $tab) { ... }
///     .onChange(of: navigation.sessionRequest) { _, request in
///         guard let request else { return }
///         tab = .azkar                       // then open `request.session` for `request.day`
///         navigation.sessionRequest = nil    // once handled
///     }
/// ```
/// `request.day` is the day the reading is filed under (yesterday for the evening azkar read
/// before Fajr), exactly as `DayPhase.sessionDay(for:today:)` gives it.
@MainActor
@Observable
final class TodayNavigation {
    static let shared = TodayNavigation()

    struct SessionRequest: Hashable, Identifiable {
        let id = UUID()
        let session: AzkarSession
        let day: DayKey
    }

    /// The reading session the user tapped on Today, until it is handled.
    var sessionRequest: SessionRequest?

    func open(_ session: AzkarSession, on day: DayKey) {
        sessionRequest = SessionRequest(session: session, day: day)
    }
}
