import AzkarKit
import SwiftUI

/// The thirty juz at a glance, each coloured by how well what is held of it stands, with a dot
/// where something is due. A juz opens to its pages; a page opens the mushaf.
struct HifzMapView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let onOpen: (Int) -> Void

    private let columns = [GridItem(.adaptive(minimum: 58), spacing: 10)]

    var body: some View {
        let today = DayKey(.now, in: app.settings.settings.timeZone)
        let map = HifzMap(progress: HifzProgress(entries: app.records.records.hifz), today: today)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HifzMapSummary(map: map)
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(map.juz) { juz in
                        NavigationLink {
                            HifzJuzPagesView(mushaf: mushaf, juz: juz.number, onOpen: onOpen)
                        } label: {
                            HifzMapCell(cell: juz, label: format.number(juz.number), height: 58)
                                .accessibilityLabel(Text(QL("Juz \(juz.number)")))
                        }
                        .buttonStyle(HifzCellPress())
                    }
                }
                HifzMapLegend()
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(Text(QL("Juz and pages")))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The pages of one juz, coloured the same way. A page opens the mushaf there.
struct HifzJuzPagesView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let juz: Int
    let onOpen: (Int) -> Void

    private let columns = [GridItem(.adaptive(minimum: 52), spacing: 8)]

    var body: some View {
        let today = DayKey(.now, in: app.settings.settings.timeZone)
        let map = HifzMap(progress: HifzProgress(entries: app.records.records.hifz), today: today)
        let cell = map.juz[juz - 1]
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(QL("\(cell.held) of \(cell.total) ayat held"))
                        .font(.headline)
                        .monospacedDigit()
                    if cell.isDue {
                        Text(QL("\(cell.due) ayat due for review"))
                            .font(.subheadline)
                            .foregroundStyle(.red)
                    }
                }
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(map.pages(ofJuz: juz)) { page in
                        Button {
                            onOpen(page.number)
                        } label: {
                            HifzMapCell(cell: page, label: format.number(page.number), height: 52)
                        }
                        .buttonStyle(HifzCellPress())
                        .accessibilityLabel(Text(QL("Page \(page.number)")))
                        .accessibilityValue(Text(QL("\(page.held) of \(page.total) ayat held")))
                    }
                }
                HifzMapLegend()
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(Text(QL("Juz \(juz)")))
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct HifzMapSummary: View {
    @Environment(\.readingLocale) private var format
    let map: HifzMap

    var body: some View {
        HStack(spacing: 24) {
            figure(QL("Pages held"), map.pagesHeld)
            figure(QL("Juz held"), map.juzHeld)
            figure(QL("Pages due"), map.pages.filter(\.isDue).count)
        }
    }

    private func figure(_ title: LocalizedStringResource, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(verbatim: format.number(value)).font(.title3.weight(.semibold)).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}

/// One juz or page: filled as far as it is held, in the colour of its weakest held ayah.
struct HifzMapCell: View {
    let cell: HifzMap.Cell
    let label: String
    let height: CGFloat

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        let tint = cell.standing?.color ?? .secondary
        ZStack(alignment: .topTrailing) {
            shape.fill(Color(.secondarySystemGroupedBackground))
            shape.fill(tint.opacity(cell.held == 0 ? 0 : 0.25 + 0.6 * cell.fraction))
            Text(verbatim: label)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(cell.held == 0 ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if cell.isDue {
                Circle().fill(.red).frame(width: 8, height: 8).padding(6)
            }
        }
        .frame(height: height)
        .overlay { shape.strokeBorder(cell.isDue ? Color.red.opacity(0.6) : Color.clear, lineWidth: 1.5) }
        .contentShape(shape)
    }
}

private struct HifzMapLegend: View {
    var body: some View {
        let items: [(Color, LocalizedStringResource)] = [HifzMap.Standing.strong, .good, .unrated, .weak].map { ($0.color, $0.title) }
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 3).fill(item.0.opacity(0.85)).frame(width: 14, height: 14)
                    Text(item.1)
                }
            }
            HStack(spacing: 8) {
                Circle().fill(.red).frame(width: 8, height: 8).frame(width: 14)
                Text(QL("Due for review"))
            }
            Text(QL("Paler where only part is held."))
                .foregroundStyle(.secondary)
        }
        .font(.footnote)
    }
}

/// A cell that sinks a little under the finger.
private struct HifzCellPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
    }
}
