import AzkarKit
import SwiftUI

/// The back of an azkar card: exactly where this reading stands, and the way into it. A tap
/// anywhere else turns the card back over.
struct AzkarCardBack: View {
    @Environment(\.todayFormat) private var format
    let session: AzkarSession
    let standing: SessionStanding
    let recommended: Bool
    let background: AnyShapeStyle
    let onFlip: () -> Void
    let onOpen: () -> Void
    let onSeeAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(session.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(session.tint)
                .lineLimit(2)
            Text(L("\(standing.done) of \(standing.total) done"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            VStack(alignment: .leading, spacing: 2) {
                ForEach(AzkarProgressLine.lines(standing, format: format), id: \.self) { line in
                    Text(verbatim: line)
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            Spacer(minLength: 4)
            HStack(spacing: 8) {
                Button(action: onOpen) {
                    Text(openTitle).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                Button(action: onSeeAll) {
                    Label { Text(L("See all")) } icon: { Image(systemName: "list.bullet") }
                        .labelStyle(.iconOnly)
                }
                .buttonStyle(.bordered)
            }
            .controlSize(.small)
            .tint(session.tint)
        }
        .monospacedDigit()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
        .background(background, in: .rect(cornerRadius: 22))
        .overlay {
            if recommended {
                RoundedRectangle(cornerRadius: 22).strokeBorder(session.tint.opacity(0.5), lineWidth: 1.5)
            }
        }
        .contentShape(.rect(cornerRadius: 22))
        .onTapGesture(perform: onFlip)
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: Text(L("Back to the card")), onFlip)
    }

    private var openTitle: LocalizedStringResource {
        switch standing.state {
        case .idle: L("Start")
        case .active: L("Continue")
        case .complete: L("Open")
        }
    }
}

/// The figures a reading's progress is told in, on the card and above its list of azkar.
enum AzkarProgressLine {
    static func lines(_ standing: SessionStanding, format: TodayFormat) -> [String] {
        var lines: [String] = []
        if standing.state != .complete {
            lines.append(format.string(L("Repetitions left: \(standing.repetitionsLeft)")))
        }
        if standing.repetitionsRead > 0 {
            lines.append(format.string(L("Repetitions read: \(standing.repetitionsRead)")))
        }
        if let at = standing.startedAt {
            lines.append(format.string(L("Started at \(format.time(at))")))
        }
        if let at = standing.completedAt {
            lines.append(format.string(L("Done at \(format.time(at))")))
        }
        return lines
    }
}

/// Every dhikr of a reading on its day and how far it got.
struct AzkarProgressSheet: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.dismiss) private var dismiss
    let session: AzkarSession
    let day: DayKey

    var body: some View {
        let records = app.records.records
        let standing = SessionStanding(session: session, day: day, dataset: app.dataset, records: records)
        let counts = records.counts[day]?[session] ?? [:]
        NavigationStack {
            List {
                Section {
                    Text(L("\(standing.done) of \(standing.total) done"))
                        .font(.headline)
                    ForEach(AzkarProgressLine.lines(standing, format: format), id: \.self) { line in
                        Text(verbatim: line)
                            .foregroundStyle(.secondary)
                    }
                }
                .monospacedDigit()
                Section {
                    ForEach(app.dataset.azkar(for: session), id: \.id) { dhikr in
                        row(dhikr, counts: counts)
                    }
                } header: {
                    Text(L("All azkar"))
                }
            }
            .navigationTitle(Text(session.title))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func row(_ dhikr: Dhikr, counts: [String: Int]) -> some View {
        let count = ReadingProgress.count(of: dhikr, in: counts)
        let target = ReadingProgress.target(of: dhikr)
        return HStack(spacing: 12) {
            Text(verbatim: RecitationText.snippet(dhikr.arabic))
                .font(.custom(RecitationFont.regular, size: 19, relativeTo: .body))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .environment(\.layoutDirection, .rightToLeft)
            if count >= target {
                Label { Text(L("Completed")) } icon: { Image(systemName: "checkmark.circle.fill") }
                    .labelStyle(.iconOnly)
                    .foregroundStyle(session.tint)
                    .font(.title3)
            } else {
                Text(L("\(count) of \(target)"))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Lays the two faces of a card on top of each other, both at the size of the larger, so a card
/// keeps its size as it turns.
struct CardFaces: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        subviews.reduce(.zero) { size, face in
            let fit = face.sizeThatFits(proposal)
            return CGSize(width: max(size.width, fit.width), height: max(size.height, fit.height))
        }
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for face in subviews {
            face.place(at: bounds.origin, proposal: ProposedViewSize(bounds.size))
        }
    }
}

/// One face of a card turning about its vertical axis: `progress` runs from 0 (front up) to 1
/// (back up), and each face shows only for its half of the turn. With Reduce Motion the faces
/// cross-fade instead.
struct FlipFace: ViewModifier, Animatable {
    var progress: Double
    let isBack: Bool
    let rotates: Bool
    /// 1 or -1: which way the card turns, so it follows the reading direction.
    let turn: Double

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let showing = isBack == (progress >= 0.5)
        let angle = (isBack ? progress - 1 : progress) * 180 * turn
        content
            .opacity(rotates ? (showing ? 1 : 0) : (isBack ? progress : 1 - progress))
            .rotation3DEffect(.degrees(rotates ? angle : 0), axis: (x: 0, y: 1, z: 0), perspective: 0.5)
            .allowsHitTesting(showing)
            .accessibilityHidden(!showing)
    }
}
