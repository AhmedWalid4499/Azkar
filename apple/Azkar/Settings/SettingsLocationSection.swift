import AzkarKit
import SwiftUI

/// The place prayer times and the Qibla are worked out for: what it is, and the ways to set,
/// change or clear it.
struct SettingsLocationSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var request = LocationRequest()
    @State private var searching = false
    @State private var confirmingClear = false
    @State private var demoQuery = ""

    private var location: SavedLocation? { app.settings.settings.location }

    var body: some View {
        Section {
            if let location {
                PlaceSummary(location: location)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Not set", tableName: SettingsText.table)
                    Text("Needed for your prayer times and the Qibla.", tableName: SettingsText.table)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }

            Button {
                Task { await request.useMyLocation(app.settings) }
            } label: {
                Label {
                    Text("Use my location", tableName: LocationText.table)
                } icon: {
                    if request.isLocating { ProgressView() } else { Image(systemName: "location.fill") }
                }
            }
            .disabled(request.isLocating)

            Button {
                searching = true
            } label: {
                Label {
                    Text("Search for a city", tableName: LocationText.table)
                } icon: {
                    Image(systemName: "magnifyingglass")
                }
            }
            .sheet(isPresented: $searching) {
                LocationSearchSheet(initialQuery: demoQuery) { place in request.save(place, to: app.settings) }
            }
            #if DEBUG
            .task {
                if let query = SettingsDemo.searchQuery, !SettingsDemo.searchShown {
                    SettingsDemo.searchShown = true
                    demoQuery = query
                    try? await Task.sleep(for: .milliseconds(300))
                    searching = true
                }
                if SettingsDemo.locateOnOpen, !SettingsDemo.locateDone {
                    SettingsDemo.locateDone = true
                    await request.useMyLocation(app.settings)
                }
            }
            #endif

            if request.phase != .idle, request.phase != .locating {
                LocationRequestStatus(phase: request.phase)
                    .font(.footnote)
            }

            if location != nil {
                Button(role: .destructive) {
                    confirmingClear = true
                } label: {
                    Label {
                        Text("Clear location", tableName: SettingsText.table)
                    } icon: {
                        Image(systemName: "location.slash")
                    }
                }
                .confirmationDialog(
                    Text("Clear your location?", tableName: SettingsText.table),
                    isPresented: $confirmingClear,
                    titleVisibility: .visible
                ) {
                    Button(role: .destructive) {
                        request.reset()
                        app.settings.update { $0.location = nil }
                    } label: {
                        Text("Clear location", tableName: SettingsText.table)
                    }
                } message: {
                    Text("Prayer times and the Qibla need a location. Your records stay as they are.", tableName: SettingsText.table)
                }
            }
        } header: {
            Text("Location", tableName: SettingsText.table)
        } footer: {
            VStack(alignment: .leading, spacing: 6) {
                if let location, zoneDiffers(location) {
                    Text("This place keeps a different time from your iPhone. If you’ve travelled, update your location.", tableName: SettingsText.table)
                        .foregroundStyle(.orange)
                }
                Text("Your location stays on this iPhone and is never followed in the background. Apple is asked for a place’s name only when you use these buttons: it receives an approximate position, or the city you type.", tableName: SettingsText.table)
            }
        }
    }

    /// The place's clocks are not the iPhone's right now.
    private func zoneDiffers(_ location: SavedLocation) -> Bool {
        let now = Date.now
        return location.zone.secondsFromGMT(for: now) != TimeZone.current.secondsFromGMT(for: now)
    }
}

/// The saved place: its name, how it was set and when, and its time zone.
private struct PlaceSummary: View {
    let location: SavedLocation
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(LocationText.label(of: location, locale: locale))
                .font(.headline)
            HStack(spacing: 4) {
                Image(systemName: location.source == .gps ? "location.fill" : "magnifyingglass")
                    .imageScale(.small)
                    .accessibilityHidden(true)
                Text(source)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            if location.updatedAt > 0 {
                Text(updated)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Text(zone)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    private var source: String {
        location.source == .gps
            ? SettingsText.string("From this iPhone", locale: locale)
            : SettingsText.string("Chosen by search", locale: locale)
    }

    private var updated: String {
        let date = Date(timeIntervalSince1970: location.updatedAt / 1000)
        let text = date.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened).locale(locale))
        return SettingsText.string("Updated \(text)", locale: locale)
    }

    private var zone: String {
        let name = location.zone.localizedName(for: .generic, locale: locale) ?? location.timeZone
        return SettingsText.string("Time zone: \(name)", locale: locale)
    }
}
