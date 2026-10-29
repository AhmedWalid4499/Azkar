import CoreLocation
import Foundation

/// One location fix on request, with when-in-use permission. Calls made while a fix is under
/// way share it. Nothing keeps running afterwards: `requestLocation()` stops by itself.
@MainActor
final class LocationFix: NSObject, CLLocationManagerDelegate {
    typealias Failure = LocationService.Failure

    private let manager = CLLocationManager()
    private var authorizationWaiters: [CheckedContinuation<Void, Never>] = []
    private var fixWaiters: [CheckedContinuation<CLLocation, any Error>] = []
    private var deadline: Task<Void, Never>?

    override init() {
        super.init()
        manager.delegate = self
        // Prayer times and the Qibla need a town, not a street.
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func current(timeout: Duration) async throws -> CLLocation {
        try await authorize()
        return try await withCheckedThrowingContinuation { continuation in
            fixWaiters.append(continuation)
            guard fixWaiters.count == 1 else { return }
            manager.requestLocation()
            deadline = Task { [weak self] in
                try? await Task.sleep(for: timeout)
                guard !Task.isCancelled else { return }
                self?.finish(.failure(Failure.timedOut))
            }
        }
    }

    private func authorize() async throws {
        guard await Self.servicesEnabled() else { throw Failure.servicesOff }
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { continuation in
                authorizationWaiters.append(continuation)
                if authorizationWaiters.count == 1 { manager.requestWhenInUseAuthorization() }
            }
        }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: return
        case .restricted: throw Failure.restricted
        default: throw Failure.denied
        }
    }

    /// Asked off the main thread: Core Location warns that the answer can take a moment.
    private nonisolated static func servicesEnabled() async -> Bool {
        await Task.detached { CLLocationManager.locationServicesEnabled() }.value
    }

    private func finish(_ result: Result<CLLocation, any Error>) {
        deadline?.cancel()
        deadline = nil
        let waiters = fixWaiters
        fixWaiters = []
        for waiter in waiters { waiter.resume(with: result) }
    }

    private func authorizationChanged(_ status: CLAuthorizationStatus) {
        guard status != .notDetermined else { return }
        let waiters = authorizationWaiters
        authorizationWaiters = []
        for waiter in waiters { waiter.resume() }
    }

    // MARK: CLLocationManagerDelegate (called on the main thread, where the manager was made)

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        MainActor.assumeIsolated { authorizationChanged(status) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        MainActor.assumeIsolated { finish(.success(location)) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        let failure: Failure = (error as? CLError)?.code == .denied ? .denied : .unavailable
        MainActor.assumeIsolated { finish(.failure(failure)) }
    }
}
