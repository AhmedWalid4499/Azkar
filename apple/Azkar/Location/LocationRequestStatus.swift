import SwiftUI
import UIKit

/// How "Use my location" is going: finding, saved without a name, or what went wrong (with a
/// way to Settings when that is where it can be fixed). Empty while idle.
struct LocationRequestStatus: View {
    let phase: LocationRequest.Phase
    @Environment(\.locale) private var locale

    var body: some View {
        switch phase {
        case .idle:
            EmptyView()
        case .locating:
            HStack(spacing: 8) {
                ProgressView()
                Text("Finding your location…", tableName: LocationText.table)
            }
            .foregroundStyle(.secondary)
            .accessibilityElement(children: .combine)
        case .savedUnnamed:
            Text("Location saved. Its name couldn’t be looked up, but the prayer times are accurate.", tableName: LocationText.table)
                .foregroundStyle(.secondary)
        case let .failed(failure):
            VStack(alignment: .leading, spacing: 6) {
                Label {
                    Text(LocationText.message(for: failure, locale: locale))
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                }
                if LocationText.opensSettings(failure), let url = URL(string: UIApplication.openSettingsURLString) {
                    Link(destination: url) {
                        Text("Open Settings", tableName: LocationText.table)
                    }
                }
            }
        }
    }
}

#Preview {
    List {
        LocationRequestStatus(phase: .locating)
        LocationRequestStatus(phase: .savedUnnamed)
        LocationRequestStatus(phase: .failed(.denied))
    }
}
