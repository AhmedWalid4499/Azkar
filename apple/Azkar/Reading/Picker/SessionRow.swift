import AzkarKit
import SwiftUI

/// One session in the picker: its name, how many azkar it has, and today's state (Start, how far
/// along, or the time it was completed), with the recommended one marked in words.
struct SessionRow: View {
    let session: AzkarSession
    /// The day its reading is filed under now.
    let day: DayKey
    let recommended: Bool
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let items = context.dataset.azkar(for: session)
        let records = context.day(day)
        let standing = ReadingStanding(items: items, counts: records.counts[session] ?? [:], record: records.sessions[session])

        NavigationLink(value: ReadingDestination.session(session, day: day)) {
            HStack(spacing: 14) {
                ReadingProgressBadge(fraction: standing.fraction, systemImage: standing.status == .complete ? "checkmark" : session.readingSymbol, tint: session.readingTint)

                VStack(alignment: .leading, spacing: 3) {
                    if recommended {
                        Text("Recommended now", tableName: "Reading")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.accentColor)
                            .textCase(.uppercase)
                    }
                    session.readingTitle
                        .font(.headline)
                    if !locale.isArabic, AzkarSession.regular.contains(session) {
                        Text(verbatim: session.readingArabicTitle)
                            .font(.custom(RecitationFont.regular, size: 17, relativeTo: .subheadline))
                            .foregroundStyle(.secondary)
                            .environment(\.layoutDirection, .rightToLeft)
                    }
                    Group {
                        switch standing.status {
                        case .notStarted:
                            Text("\(items.count) azkar · Start", tableName: "Reading")
                        case .inProgress:
                            Text("\(standing.done) of \(standing.total) done", tableName: "Reading")
                        case .complete:
                            if let at = standing.completedAt {
                                Text("Done at \(locale.time(at))", tableName: "Reading")
                            } else {
                                Text("Completed", tableName: "Reading")
                            }
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(standing.status == .complete ? AnyShapeStyle(Color.readingDone) : AnyShapeStyle(.secondary))
                    .monospacedDigit()
                    .redacted(reason: context.records.isLoaded ? [] : .placeholder)
                }
            }
            .padding(.vertical, 4)
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint(Text("Opens the reader", tableName: "Reading"))
    }
}

/// A small ring that fills with a session's progress, around the session's symbol.
struct ReadingProgressBadge: View {
    let fraction: Double
    let systemImage: String
    let tint: Color
    @ScaledMetric(relativeTo: .headline) private var diameter: CGFloat = 44

    var body: some View {
        ZStack {
            ReadingRing(progress: fraction, color: tint, lineWidth: 3.5)
            Image(systemName: systemImage)
                .font(.system(size: diameter * 0.4, weight: .semibold))
                .foregroundStyle(tint)
                .contentTransition(.symbolEffect(.replace))
        }
        .frame(width: diameter, height: diameter)
        .animation(.smooth, value: fraction)
        .accessibilityHidden(true)
    }
}
