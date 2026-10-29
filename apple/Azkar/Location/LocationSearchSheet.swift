import AzkarKit
import SwiftUI

/// Finds a city with Apple Maps as the user types, and hands back the one they pick.
struct LocationSearchSheet: View {
    let onPick: (SavedLocation) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @State private var query = ""
    @State private var state: SearchState = .waiting

    init(initialQuery: String = "", onPick: @escaping (SavedLocation) -> Void) {
        self.onPick = onPick
        _query = State(initialValue: initialQuery)
    }

    private enum SearchState: Equatable {
        case waiting
        case searching
        case results([SavedLocation])
        case failed
    }

    var body: some View {
        NavigationStack {
            List {
                content
            }
            .navigationTitle(Text("Search for a city", tableName: LocationText.table))
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: Text("City name", tableName: LocationText.table)
            )
            .searchPresentationToolbarBehavior(.avoidHidingContent)
            .autocorrectionDisabled()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
            .task(id: query) { await search() }
            #if DEBUG
            .task {
                // `-AzkarDemoSearch <text>` types a search, for checks in the simulator.
                if query.isEmpty, let text = UserDefaults.standard.string(forKey: "AzkarDemoSearch") {
                    try? await Task.sleep(for: .milliseconds(300))
                    query = text
                }
            }
            #endif
        }
    }

    @ViewBuilder private var content: some View {
        switch state {
        case .waiting:
            hint(Text("Type at least two letters of a city’s name.", tableName: LocationText.table))
        case .searching:
            HStack(spacing: 12) {
                ProgressView()
                Text("Searching…", tableName: LocationText.table).foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
        case let .results(places) where places.isEmpty:
            ContentUnavailableView.search(text: query.trimmingCharacters(in: .whitespacesAndNewlines))
                .listRowBackground(Color.clear)
        case let .results(places):
            Section {
                ForEach(places, id: \.self) { place in
                    Button {
                        onPick(place)
                        dismiss()
                    } label: {
                        PlaceRow(place: place)
                    }
                    .tint(.primary)
                }
            } footer: {
                Text("Places from Apple Maps.", tableName: LocationText.table)
            }
        case .failed:
            hint(Text("Apple Maps couldn’t be reached. Check your connection and try again. “Use my location” works without one.", tableName: LocationText.table))
        }
    }

    private func hint(_ text: Text) -> some View {
        text.foregroundStyle(.secondary).listRowBackground(Color.clear)
    }

    private func search() async {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= LocationPlaceNamer.minimumQueryLength else {
            state = .waiting
            return
        }
        // Wait for a pause in typing; a new keystroke cancels this task.
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        if case .results = state {} else { state = .searching }
        do {
            let places = try await LocationService.shared.search(text)
            guard !Task.isCancelled else { return }
            state = .results(places)
        } catch {
            guard !Task.isCancelled else { return }
            state = .failed
        }
    }
}

/// A found place: its name, with the zone it keeps time in.
private struct PlaceRow: View {
    let place: SavedLocation
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(LocationText.label(of: place, locale: locale))
            Text(zoneText)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    private var zoneText: String {
        let zone = place.zone
        let name = zone.localizedName(for: .generic, locale: locale) ?? place.timeZone
        return name
    }
}

#Preview {
    LocationSearchSheet { _ in }
}
