import AzkarKit
import SwiftUI
import UIKit

/// "Use my location" and "Search for a city", shared by the first-run card and the location
/// sheet. Saves what is found through the settings and says, in words, what went wrong.
@MainActor
@Observable
final class LocationChooser {
    private(set) var isLocating = false
    private(set) var failure: LocationService.Failure?
    var showsSearch = false

    func locateMe(_ app: AppEnvironment, format: TodayFormat) async {
        guard !isLocating else { return }
        isLocating = true
        failure = nil
        defer { isLocating = false }
        do {
            let place = try await LocationService.shared.locateMe()
            save(place, app, format: format)
        } catch let error as LocationService.Failure {
            failure = error
        } catch {
            failure = .unavailable
        }
    }

    func save(_ place: SavedLocation, _ app: AppEnvironment, format: TodayFormat) {
        app.settings.update { $0.location = place }
        failure = nil
        AccessibilityNotification.Announcement(format.string(L("Location set: \(format.place(place))"))).post()
    }
}

extension LocationService.Failure {
    var message: LocalizedStringResource {
        switch self {
        case .denied: L("Location access is off for Azkar. Allow it in Settings, or search for your city instead.")
        case .restricted: L("Location access is restricted on this iPhone, for example by Screen Time. Search for your city instead.")
        case .servicesOff: L("Location Services are turned off. Turn them on in Settings › Privacy & Security, or search for your city.")
        case .unavailable: L("Your iPhone couldn’t work out where it is. Try again, or search for your city.")
        case .timedOut: L("Finding your location took too long. Try again, or search for your city.")
        }
    }

    /// The failures the Settings app can fix.
    var opensSettings: Bool { self == .denied || self == .servicesOff }
}

/// The two ways to set the place, with progress and errors, as list rows.
struct LocationChoiceRows: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.openURL) private var openURL
    @Bindable var chooser: LocationChooser
    var onSaved: () -> Void = {}

    var body: some View {
        Button {
            Task {
                await chooser.locateMe(app, format: format)
                if chooser.failure == nil { onSaved() }
            }
        } label: {
            HStack {
                Label { Text(chooser.isLocating ? L("Finding your location…") : L("Use my location")) } icon: {
                    Image(systemName: "location.fill")
                }
                Spacer()
                if chooser.isLocating { ProgressView() }
            }
        }
        .disabled(chooser.isLocating)

        Button {
            chooser.showsSearch = true
        } label: {
            Label { Text(L("Search for a city")) } icon: { Image(systemName: "magnifyingglass") }
        }

        if let failure = chooser.failure {
            VStack(alignment: .leading, spacing: 8) {
                Label {
                    Text(failure.message).font(.subheadline)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                }
                if failure.opensSettings, let url = URL(string: UIApplication.openSettingsURLString) {
                    Button { openURL(url) } label: { Text(L("Open Settings")) }
                        .buttonStyle(.bordered)
                }
            }
            .accessibilityElement(children: .contain)
        }
    }
}

/// Shown on Today until a place is saved.
struct LocationPromptCard: View {
    @Environment(AppEnvironment.self) private var app
    @State private var chooser = LocationChooser()

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Label {
                    Text(L("Set your location")).font(.title3.bold())
                } icon: {
                    Image(systemName: "location.circle.fill").foregroundStyle(.tint).font(.title2)
                }
                Text(L("Prayer times are calculated on your iPhone from where you are. Your location stays on this iPhone."))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 6)
            .accessibilityElement(children: .combine)
            LocationChoiceRows(chooser: chooser)
        }
        .sheet(isPresented: $chooser.showsSearch) { CitySearchSheet(chooser: chooser) }
    }
}

/// A saved place that cannot be calculated for.
struct UnusableLocationCard: View {
    @Binding var showsLocation: Bool

    var body: some View {
        Section {
            Label {
                Text(L("The saved location can’t be read. Please set it again."))
            } icon: {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            }
            Button { showsLocation = true } label: { Text(L("Set location")) }
        }
    }
}

/// Opened from the place under the date: the current place, and the two ways to change it.
struct LocationSheet: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.dismiss) private var dismiss
    @State private var chooser = LocationChooser()

    var body: some View {
        NavigationStack {
            List {
                if let location = app.settings.settings.location {
                    Section {
                        LabeledContent {
                            Text(verbatim: location.zone.identifier).foregroundStyle(.secondary)
                        } label: {
                            Text(verbatim: format.place(location))
                            Text(location.source == .gps ? L("From this iPhone") : L("Chosen by search"))
                        }
                    } header: {
                        Text(L("Current location"))
                    }
                }
                Section {
                    LocationChoiceRows(chooser: chooser) { dismiss() }
                } footer: {
                    Text(L("Your location stays on this iPhone. Apple’s place search is used only when you search, or to name the place you are in."))
                }
            }
            .navigationTitle(Text(L("Location")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(role: .close) { dismiss() }
                }
            }
            .sheet(isPresented: $chooser.showsSearch) {
                CitySearchSheet(chooser: chooser) { dismiss() }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
