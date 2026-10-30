import AzkarKit
import SwiftUI

/// The tracker's main page, one grouped list.
struct TrackerList: View {
    let data: TrackerData
    @Binding var path: [TrackerRoute]
    /// The month on show; `nil` follows today's, so an open page moves on with the date.
    @State private var month: GregorianMonth?

    var body: some View {
        ScrollViewReader { reader in
            List {
                if data.hasAnyRecord {
                    TrackerOverviewSection(data: data)
                } else {
                    TrackerEmptySection()
                }
                TrackerAreasSection(data: data)
                TrackerCalendarSection(data: data, month: $month) { path.append(.day($0)) }.id(Part.calendar)
                TrackerExportSection(data: data).id(Part.export)
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(.compact)
            #if DEBUG
            .task(id: data.hasAnyRecord) {
                guard let target = TrackerShowcase.scrollTarget.flatMap(Part.init(rawValue:)) else { return }
                try? await Task.sleep(for: .milliseconds(400))
                reader.scrollTo(target, anchor: .top)
            }
            #endif
        }
    }

    /// The page's parts, to scroll to.
    enum Part: String {
        case calendar, export
    }
}
