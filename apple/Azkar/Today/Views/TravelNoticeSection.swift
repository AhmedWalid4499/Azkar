import AzkarKit
import SwiftUI

/// Shown when the iPhone's clock has moved away from the saved place's, which means the user has
/// most likely travelled and the prayer times are for somewhere else. One tap finds where they
/// are; "Keep" leaves it be until the iPhone's zone changes again. Nothing is looked up until
/// that tap, so the location stays on request.
struct TravelNoticeSection: View {
    @Environment(AppEnvironment.self) private var app
    let context: TodayContext
    @Binding var showsLocation: Bool
    /// The iPhone's zone the user chose to keep the saved place in.
    @AppStorage("travel.keptZone") private var keptZone = ""
    @State private var isLocating = false

    var body: some View {
        let zone = TimeZone.current
        if let location = context.location, location.keepsDifferentTime(from: zone, at: context.now), keptZone != zone.identifier {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Label {
                        Text(L("Have you travelled?")).font(.headline)
                    } icon: {
                        Image(systemName: "airplane").foregroundStyle(.orange)
                    }
                    Text(location.label.isEmpty ? L("Prayer times are still for your saved place, which keeps a different time from your iPhone.") : L("Prayer times are still for \(location.label), which keeps a different time from your iPhone."))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 10) {
                        Button {
                            Task { await update() }
                        } label: {
                            Text(L("Update location")).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isLocating)
                        Button {
                            keptZone = zone.identifier
                        } label: {
                            Text(L("Keep")).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    /// Finds the user. If that can't be done here, the location sheet offers the other ways.
    private func update() async {
        isLocating = true
        defer { isLocating = false }
        do {
            let found = try await LocationService.shared.locateMe()
            app.settings.update { $0.location = found }
        } catch {
            showsLocation = true
        }
    }
}
