import CoreLocation
import Observation
import SwiftUI
import UIKit

/// The phone's heading while the Qibla screen is on screen, smoothed.
///
/// True north when Core Location can give it (it needs the position, so location updates run at
/// city accuracy while the screen is visible, and only if permission was already given); magnetic
/// north otherwise, which the screen notes. Everything stops when the screen goes away.
@MainActor
@Observable
final class QiblaCompass {
    enum North: Equatable {
        case geographic
        case magnetic
    }

    /// Whether this device has a compass at all (the simulator has none).
    let isAvailable: Bool
    /// Degrees clockwise from north of the top of the screen; `nil` until the first reading.
    private(set) var heading: Double?
    /// The same heading without wrapping at 360, so the dial turns the short way.
    private(set) var continuousHeading: Double = 0
    private(set) var north: North = .magnetic
    /// The compass is unsure of its direction and needs a figure-eight.
    private(set) var needsCalibration = false

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private let receiver = HeadingReceiver()
    @ObservationIgnored private var lastReadingAt: Date?
    @ObservationIgnored private var running = false

    init(isAvailable: Bool = CLLocationManager.headingAvailable()) {
        self.isAvailable = isAvailable
        receiver.onHeading = { [weak self] reading in self?.receive(reading) }
        manager.delegate = receiver
        manager.headingFilter = 1
    }

    func start() {
        guard isAvailable, !running else { return }
        running = true
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            // Only so the heading can be given from true north; never kept in the background.
            manager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
            manager.startUpdatingLocation()
        default:
            break
        }
        manager.startUpdatingHeading()
    }

    func stop() {
        guard running else { return }
        running = false
        manager.stopUpdatingHeading()
        manager.stopUpdatingLocation()
        lastReadingAt = nil
    }

    private func receive(_ reading: HeadingReceiver.Reading) {
        let raw: Double
        if reading.trueHeading >= 0 {
            raw = reading.trueHeading
            north = .geographic
        } else if reading.magneticHeading >= 0 {
            raw = reading.magneticHeading
            north = .magnetic
        } else {
            return
        }
        let now = Date.now
        let elapsed = lastReadingAt.map { now.timeIntervalSince($0) } ?? 0
        lastReadingAt = now
        let next = QiblaMath.smoothed(previous: heading, next: raw, elapsed: elapsed)
        if let heading {
            continuousHeading += QiblaMath.signedDelta(from: heading, to: next)
        } else {
            continuousHeading = next
        }
        heading = next
        let poor = QiblaMath.isPoorAccuracy(reading.accuracy)
        if poor != needsCalibration { needsCalibration = poor }
    }

    /// Headings are given for the top of `view` as it is shown, whichever way the phone is turned.
    /// Before iOS 27, for the top of the screen in its current orientation. Called again on each layout.
    func measure(from view: UIView?) {
        if #available(iOS 27.0, *) {
            if manager.headingBody !== view { manager.headingBody = view }
        } else if let orientation = view?.window?.windowScene?.interfaceOrientation {
            let device: CLDeviceOrientation = switch orientation {
            case .portraitUpsideDown: .portraitUpsideDown
            // The interface turns the other way from the device.
            case .landscapeLeft: .landscapeRight
            case .landscapeRight: .landscapeLeft
            default: .portrait
            }
            if manager.headingOrientation != device { manager.headingOrientation = device }
        }
    }
}

/// Core Location's delegate for the compass; hands each heading to the main actor.
private final class HeadingReceiver: NSObject, CLLocationManagerDelegate {
    struct Reading: Sendable {
        var trueHeading: Double
        var magneticHeading: Double
        var accuracy: Double
    }

    var onHeading: ((Reading) -> Void)?

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let reading = Reading(trueHeading: newHeading.trueHeading, magneticHeading: newHeading.magneticHeading, accuracy: newHeading.headingAccuracy)
        MainActor.assumeIsolated { onHeading?(reading) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {}

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {}

    /// The screen shows its own calibration hint instead of the system's sheet.
    nonisolated func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { false }
}

/// An empty view the compass measures headings from, so holding the phone in landscape keeps
/// the heading true for the screen.
struct QiblaHeadingAnchor: UIViewRepresentable {
    let onView: (UIView?) -> Void

    func makeUIView(context: Context) -> AnchorView {
        let view = AnchorView()
        view.isUserInteractionEnabled = false
        view.isAccessibilityElement = false
        view.onLayout = onView
        onView(view)
        return view
    }

    func updateUIView(_ uiView: AnchorView, context: Context) {}

    /// Tells again after it joins a window and after each layout (a turn of the phone lays it out anew).
    final class AnchorView: UIView {
        var onLayout: ((UIView?) -> Void)?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            onLayout?(self)
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            onLayout?(self)
        }
    }
}
