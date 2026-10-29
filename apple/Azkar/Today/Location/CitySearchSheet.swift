import AzkarKit
import SwiftUI

/// Searches for a city as the user types (after a short pause) and saves the one chosen.
struct CitySearchSheet: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.dismiss) private var dismiss
    let chooser: LocationChooser
    var onSaved: () -> Void = {}

    @State private var query = ""
    @State private var phase = Phase.idle

    private enum Phase: Equatable {
        case idle
        case searching
        case results([SavedLocation])
        case failed
    }

    private static let minimumLetters = 2

    var body: some View {
        NavigationStack {
            List {
                switch phase {
                case .idle:
                    EmptyView()
                case .searching:
                    HStack(spacing: 10) {
                        ProgressView()
                        Text(L("Searching…")).foregroundStyle(.secondary)
                    }
                case let .results(places) where places.isEmpty:
                    ContentUnavailableView {
                        Label { Text(L("No places found")) } icon: { Image(systemName: "magnifyingglass") }
                    } description: {
                        Text(L("Nothing matches “\(trimmed)”. Check the spelling, or try a nearby city."))
                    }
                    .listRowBackground(Color.clear)
                case let .results(places):
                    Section {
                        ForEach(places, id: \.self) { place in
                            Button { choose(place) } label: { row(place) }
                                .foregroundStyle(.primary)
                        }
                    }
                case .failed:
                    ContentUnavailableView {
                        Label { Text(L("Search unavailable")) } icon: { Image(systemName: "wifi.exclamationmark") }
                    } description: {
                        Text(L("The place search couldn’t be reached. Check your connection and try again; “Use my location” works without one."))
                    }
                    .listRowBackground(Color.clear)
                }
            }
            .overlay {
                if phase == .idle {
                    ContentUnavailableView {
                        Label { Text(L("Search for a city")) } icon: { Image(systemName: "building.2") }
                    } description: {
                        Text(L("Type at least two letters of your city’s name."))
                    }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: Text(L("City name")))
            .navigationTitle(Text(L("Search for a city")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
            }
            .task(id: trimmed) { await search(trimmed) }
        }
    }

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func row(_ place: SavedLocation) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: format.place(place))
            Text(verbatim: subtitle(place))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    private func subtitle(_ place: SavedLocation) -> String {
        let country = place.countryCode.flatMap { format.locale.localizedString(forRegionCode: $0) }
        let coordinates = format.coordinates(latitude: place.latitude, longitude: place.longitude)
        return [country, coordinates].compactMap { $0 }.joined(separator: " · ")
    }

    private func search(_ text: String) async {
        guard text.count >= Self.minimumLetters else {
            phase = .idle
            return
        }
        // Wait for a pause in typing; a new letter cancels this task.
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        phase = .searching
        do {
            let places = try await LocationService.shared.search(text)
            guard !Task.isCancelled else { return }
            phase = .results(places)
        } catch {
            guard !Task.isCancelled else { return }
            phase = .failed
        }
    }

    private func choose(_ place: SavedLocation) {
        chooser.save(place, app, format: format)
        dismiss()
        onSaved()
    }
}
