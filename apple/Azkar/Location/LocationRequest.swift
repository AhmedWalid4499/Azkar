import AzkarKit
import Foundation
import Observation

/// "Use my location" for a screen: finds the place, saves it, and says how it went.
@MainActor
@Observable
final class LocationRequest {
    enum Phase: Equatable {
        case idle
        case locating
        /// Saved, but its name could not be looked up.
        case savedUnnamed
        case failed(LocationService.Failure)
    }

    private(set) var phase: Phase = .idle

    var isLocating: Bool { phase == .locating }

    func useMyLocation(_ settings: SettingsModel) async {
        guard phase != .locating else { return }
        phase = .locating
        do {
            let place = try await LocationService.shared.locateMe()
            settings.update { $0.location = place }
            phase = place.label.isEmpty ? .savedUnnamed : .idle
        } catch let failure as LocationService.Failure {
            phase = .failed(failure)
        } catch {
            phase = .failed(.unavailable)
        }
    }

    func save(_ place: SavedLocation, to settings: SettingsModel) {
        settings.update { $0.location = place }
        phase = .idle
    }

    func reset() {
        if phase != .locating { phase = .idle }
    }
}
