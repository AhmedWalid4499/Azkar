import AzkarKit
import SwiftUI

/// The dial and the facts of the direction, with the live compass when the phone has one and a
/// north-up dial to line up by hand when it does not.
struct QiblaCompassView: View {
    let location: SavedLocation
    let direction: QiblaDirection

    @State private var compass = QiblaCompass()
    @State private var aligned = false
    @State private var visible = false
    @State private var spoken = QiblaSpokenTurn()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.locale) private var locale
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver

    /// Degrees still to turn, clockwise positive; `nil` without a live heading.
    private var turn: Double? {
        compass.heading.map { QiblaMath.signedDelta(from: $0, to: direction.bearing) }
    }

    var body: some View {
        List {
            Section {
                dial
                status
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)

            if compass.isAvailable, compass.heading != nil, compass.needsCalibration {
                Section {
                    Label {
                        Text("The compass is unsure of its direction. Move your iPhone in a figure-eight a few times, away from metal, to calibrate it.", tableName: QiblaText.table)
                    } icon: {
                        Image(systemName: "infinity")
                            .symbolEffect(.pulse, options: .repeating)
                            .foregroundStyle(.orange)
                    }
                }
            }

            facts
        }
        .contentMargins(.top, 0, for: .scrollContent)
        .background { QiblaHeadingAnchor { compass.measure(from: $0) }.allowsHitTesting(false) }
        .onAppear {
            visible = true
            compass.start()
        }
        .onDisappear {
            visible = false
            compass.stop()
        }
        // Another tab stays alive while hidden: only the screen on view uses the compass.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, visible { compass.start() } else { compass.stop() }
        }
        .onChange(of: turn) { _, turn in
            let next = turn.map { QiblaMath.isAligned(wasAligned: aligned, turn: $0) } ?? false
            if next != aligned { aligned = next }
            let text = turn.map { QiblaText.turn($0, aligned: next, locale: locale) } ?? ""
            spoken.offer(text, urgent: next != spoken.wasAligned, aligned: next)
        }
        .onChange(of: aligned) { _, isAligned in
            if isAligned, voiceOver {
                AccessibilityNotification.Announcement(QiblaText.string("You’re facing the Qibla", locale: locale)).post()
            }
        }
        // One tap each time the phone comes into line; holding it there gives no more.
        .sensoryFeedback(trigger: aligned) { _, isAligned in isAligned ? .success : nil }
    }

    private var dial: some View {
        QiblaDial(
            bearing: direction.bearing,
            heading: compass.heading == nil ? 0 : compass.continuousHeading,
            isAligned: aligned
        )
        .frame(maxWidth: 340)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .animation(.linear(duration: 0.12), value: compass.continuousHeading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(dialLabel))
        .accessibilityValue(Text(spoken.text))
        .accessibilityAddTraits(compass.heading == nil ? [] : .updatesFrequently)
    }

    private var dialLabel: String {
        let degrees = QiblaText.degrees(direction.bearing, locale: locale)
        return QiblaText.string("Compass dial, with the Qibla at \(degrees) from north", locale: locale)
    }

    @ViewBuilder private var status: some View {
        Group {
            if !compass.isAvailable {
                Text("North is at the top of the dial. Point the top of your iPhone north, using a map or a landmark you know, and the Kaaba on the dial shows the Qibla.", tableName: QiblaText.table)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else if let turn {
                Label {
                    Text(QiblaText.turn(turn, aligned: aligned, locale: locale))
                        .contentTransition(.numericText())
                } icon: {
                    Image(systemName: aligned ? "checkmark.circle.fill" : (turn > 0 ? "arrow.turn.up.right" : "arrow.turn.up.left"))
                        .foregroundStyle(aligned ? Color.green : Color.accentColor)
                        .symbolEffect(.bounce, value: aligned)
                }
                .font(.title3.weight(.semibold))
                .accessibilityHidden(true)
            } else {
                VStack(spacing: 4) {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Waiting for the compass…", tableName: QiblaText.table)
                    }
                    Text("Hold your iPhone flat, away from metal and magnets.", tableName: QiblaText.table)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }

    private var facts: some View {
        Section {
            LabeledContent {
                Text(QiblaText.degrees(direction.bearing, locale: locale))
                    .font(.title2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.primary)
            } label: {
                Text("Qibla direction", tableName: QiblaText.table)
                Text(QiblaText.toward(direction.cardinal, locale: locale))
            }
            LabeledContent {
                Text(QiblaText.distance(direction.distanceKm, locale: locale))
            } label: {
                Text("Distance to the Kaaba", tableName: QiblaText.table)
            }
            LabeledContent {
                Text(LocationText.label(of: location, locale: locale))
                    .multilineTextAlignment(.trailing)
            } label: {
                Text("From", tableName: QiblaText.table)
            }
        } footer: {
            VStack(alignment: .leading, spacing: 8) {
                Text("Measured clockwise from true north.", tableName: QiblaText.table)
                if compass.heading != nil, compass.north == .magnetic {
                    Text("Your iPhone’s compass is using magnetic north here, while the direction is measured from true north. In most places the two are a few degrees apart, so the dial can be off by that much; compare it with a mosque’s mihrab or a landmark you know.", tableName: QiblaText.table)
                }
            }
        }
    }
}

/// What VoiceOver hears of the live compass: at most every few seconds, so turning the phone is
/// not a stream of numbers, but coming into line (or leaving it) is passed on at once.
@MainActor
@Observable
final class QiblaSpokenTurn {
    static let interval: Duration = .seconds(3)

    private(set) var text = ""
    private(set) var wasAligned = false
    @ObservationIgnored private var lastAt = ContinuousClock.now - QiblaSpokenTurn.interval
    @ObservationIgnored private var pending: Task<Void, Never>?
    @ObservationIgnored private var latest = ""

    func offer(_ next: String, urgent: Bool, aligned: Bool) {
        latest = next
        wasAligned = aligned
        guard next != text else { return }
        let wait = urgent ? .zero : max(.zero, lastAt + Self.interval - ContinuousClock.now)
        pending?.cancel()
        guard wait > .zero else {
            show()
            return
        }
        pending = Task { [weak self] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled else { return }
            self?.show()
        }
    }

    private func show() {
        text = latest
        lastAt = .now
    }
}

#Preview("Cairo") {
    NavigationStack {
        QiblaCompassView(
            location: SavedLocation(latitude: 30.044, longitude: 31.236, timeZone: "Africa/Cairo", label: "Cairo, Egypt", countryCode: "EG", source: .manual, updatedAt: 0),
            direction: QiblaDirection(latitude: 30.044, longitude: 31.236)
        )
        .navigationTitle("Qibla")
    }
}
