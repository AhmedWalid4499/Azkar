import AzkarKit
import SwiftUI

/// No place saved yet: the direction is worked out from one, so ask for it here.
struct QiblaNoLocationView: View {
    @Environment(AppEnvironment.self) private var app
    @State private var request = LocationRequest()
    @State private var searching = false

    var body: some View {
        ContentUnavailableView {
            Label {
                Text("Set your location", tableName: QiblaText.table)
            } icon: {
                Image(systemName: "location.north.circle")
            }
        } description: {
            Text("The Qibla direction is worked out from where you are. Use your location, or search for your city.", tableName: QiblaText.table)
        } actions: {
            QiblaLocationActions(request: request, searching: $searching)
        }
        .sheet(isPresented: $searching) {
            LocationSearchSheet { place in request.save(place, to: app.settings) }
        }
    }
}

/// Within a kilometre of the Kaaba a bearing says little: face the Kaaba itself.
struct QiblaNearView: View {
    let location: SavedLocation
    @Environment(AppEnvironment.self) private var app
    @State private var request = LocationRequest()
    @State private var searching = false

    var body: some View {
        ContentUnavailableView {
            Label {
                Text("You’re close to the Kaaba", tableName: QiblaText.table)
            } icon: {
                Image(systemName: "cube.fill")
            }
        } description: {
            Text("Your saved location is less than a kilometre from the Kaaba. This close, the direction depends on exactly where you stand, so face the Kaaba itself. If you’re farther away, use your location to get a direction from where you are.", tableName: QiblaText.table)
        } actions: {
            QiblaLocationActions(request: request, searching: $searching)
        }
        .sheet(isPresented: $searching) {
            LocationSearchSheet { place in request.save(place, to: app.settings) }
        }
    }
}

/// "Use my location" and "Search for a city", with how the first is going.
private struct QiblaLocationActions: View {
    let request: LocationRequest
    @Binding var searching: Bool
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        VStack(spacing: 12) {
            Button {
                Task { await request.useMyLocation(app.settings) }
            } label: {
                Label {
                    Text("Use my location", tableName: LocationText.table)
                } icon: {
                    Image(systemName: "location.fill")
                }
            }
            .buttonStyle(.glassProminent)
            .disabled(request.isLocating)

            Button {
                searching = true
            } label: {
                Text("Search for a city", tableName: LocationText.table)
            }
            .buttonStyle(.glass)

            LocationRequestStatus(phase: request.phase)
                .font(.footnote)
                .controlSize(.regular)
                .multilineTextAlignment(.center)
        }
        .controlSize(.large)
    }
}

#Preview("No location") {
    NavigationStack { QiblaNoLocationView() }
        .environment(try! AppEnvironment())
}
