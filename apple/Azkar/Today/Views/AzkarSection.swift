import AzkarKit
import SwiftUI

/// The azkar of the day as cards: morning and evening, the bedtime azkar at night, and the
/// azkar after the most recent prayer, each with where today's reading stands. The session the
/// clock recommends is set apart. A tap turns the card over to its progress, and the back asks
/// for that reading (see `TodayNavigation`).
struct AzkarSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dynamicTypeSize) private var typeSize
    let context: TodayContext

    var body: some View {
        let sessions = shownSessions
        if !sessions.isEmpty {
            Section {
                let columns = typeSize.isAccessibilitySize
                    ? [GridItem(.flexible())]
                    : [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(sessions, id: \.self) { session in
                        AzkarCard(
                            session: session,
                            day: context.phase.sessionDay(for: session, today: context.today),
                            recommended: context.phase.recommendedSession == session
                        )
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                .id("today.azkar")
            } header: {
                Text(L("Daily azkar"))
            }
        }
    }

    /// Morning and evening always (when the dataset has them); bedtime at night; after-prayer
    /// for the prayer whose time came last.
    private var shownSessions: [AzkarSession] {
        let dataset = app.dataset
        var sessions = [AzkarSession.morning, .evening].filter { !dataset.azkar(for: $0).isEmpty }
        if isNight, !dataset.azkar(for: .sleep).isEmpty { sessions.append(.sleep) }
        if let latest = context.schedule?.timeline.entries.last(where: { $0.at <= context.now }),
           !dataset.afterPrayerAzkar(for: latest.prayer).isEmpty {
            sessions.append(.afterPrayer(latest.prayer))
        }
        return sessions
    }

    /// From Isha until Fajr (from 8 pm without a timetable).
    private var isNight: Bool {
        if context.beforeDawn { return true }
        if let isha = context.todayTimes?[.isha] { return context.now >= isha }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = context.timeZone
        return calendar.component(.hour, from: context.now) >= 20
    }
}

/// Where one session's reading stands on a day.
struct SessionStanding {
    enum State { case idle, active, complete }

    let state: State
    let done: Int
    let total: Int
    let completedAt: Date?
    let startedAt: Date?
    /// Repetitions still to read in the current reading.
    let repetitionsLeft: Int
    /// Repetitions counted on the day, all readings together.
    let repetitionsRead: Int

    var fraction: Double { total == 0 ? 0 : Double(done) / Double(total) }

    /// The day's counts, overruled by its record once the session was completed: a completion
    /// stays on show after "Start over", while the counts begin again (as the website).
    init(session: AzkarSession, day: DayKey, dataset: AzkarDataset, records: RecordsSnapshot) {
        let items = dataset.azkar(for: session)
        let counts = records.counts[day]?[session] ?? [:]
        let record = records.sessions[day]?[session]
        let done = items.filter { (counts[$0.id] ?? 0) >= max(1, $0.repeat) }.count
        total = items.count
        startedAt = record?.startedAt
        repetitionsRead = record?.recitations ?? 0
        if record?.completed == true || (total > 0 && done == total) {
            state = .complete
            self.done = total
            completedAt = record?.completedAt
            repetitionsLeft = 0
        } else {
            state = counts.values.contains { $0 > 0 } ? .active : .idle
            self.done = done
            completedAt = nil
            repetitionsLeft = items.reduce(0) { $0 + ReadingProgress.target(of: $1) - ReadingProgress.count(of: $1, in: counts) }
        }
    }
}

private struct AzkarCard: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    let session: AzkarSession
    let day: DayKey
    let recommended: Bool
    @State private var flipped = false
    @State private var showsAll = false

    init(session: AzkarSession, day: DayKey, recommended: Bool) {
        self.session = session
        self.day = day
        self.recommended = recommended
        #if DEBUG
        _flipped = State(initialValue: TodayDebugLaunch.flip.contains(session.description))
        _showsAll = State(initialValue: TodayDebugLaunch.progress == session.description)
        #endif
    }

    var body: some View {
        let standing = SessionStanding(session: session, day: day, dataset: app.dataset, records: app.records.records)
        let progress = flipped ? 1.0 : 0.0
        let turn = layoutDirection == .rightToLeft ? -1.0 : 1.0
        CardFaces {
            front(standing)
                .modifier(FlipFace(progress: progress, isBack: false, rotates: !reduceMotion, turn: turn))
            AzkarCardBack(
                session: session,
                standing: standing,
                recommended: recommended,
                background: background,
                onFlip: flip,
                onOpen: { TodayNavigation.shared.open(session, on: day) },
                onSeeAll: { showsAll = true }
            )
            .modifier(FlipFace(progress: progress, isBack: true, rotates: !reduceMotion, turn: turn))
        }
        .zIndex(flipped ? 1 : 0)
        .sensoryFeedback(.selection, trigger: flipped)
        .onChange(of: day) { flipped = false }
        .sheet(isPresented: $showsAll) {
            AzkarProgressSheet(session: session, day: day)
        }
    }

    private func flip() {
        withAnimation(.snappy(duration: 0.5)) { flipped.toggle() }
    }

    private func front(_ standing: SessionStanding) -> some View {
        Button(action: flip) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    ProgressRing(fraction: standing.fraction, tint: session.tint) {
                        Image(systemName: standing.state == .complete ? "checkmark" : session.symbol)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(session.tint)
                            .contentTransition(.symbolEffect(.replace))
                    }
                    Spacer(minLength: 4)
                    if recommended {
                        Text(L("Now"))
                            .font(.caption.weight(.bold))
                            .textCase(.uppercase)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(session.tint, in: .capsule)
                            .foregroundStyle(.white)
                    }
                }
                Text(session.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                stateText(standing)
                    .monospacedDigit()
                    .font(.subheadline)
                    .foregroundStyle(standing.state == .complete ? AnyShapeStyle(session.tint) : AnyShapeStyle(.secondary))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(14)
            .background(background, in: .rect(cornerRadius: 22))
            .overlay {
                if recommended {
                    RoundedRectangle(cornerRadius: 22).strokeBorder(session.tint.opacity(0.5), lineWidth: 1.5)
                }
            }
            .contentShape(.rect(cornerRadius: 22))
        }
        .buttonStyle(PressableCardStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(session.title))
        .accessibilityValue(accessibilityValue(standing))
        .accessibilityHint(Text(L("Shows the progress of this reading")))
        .accessibilityAction(named: Text(L("Open the reading"))) {
            TodayNavigation.shared.open(session, on: day)
        }
    }

    private var background: AnyShapeStyle {
        recommended ? AnyShapeStyle(session.tint.opacity(0.14)) : AnyShapeStyle(Color(.secondarySystemGroupedBackground))
    }

    private func stateText(_ standing: SessionStanding) -> Text {
        switch standing.state {
        case .complete:
            if let at = standing.completedAt { return Text(L("Done at \(format.time(at))")) }
            return Text(L("Completed"))
        case .active: return Text(L("\(standing.done) of \(standing.total)"))
        case .idle: return Text(L("Start"))
        }
    }

    private func accessibilityValue(_ standing: SessionStanding) -> Text {
        let state = format.string(L(stateKey(standing)))
        return recommended ? Text(L("\(state). Recommended now")) : Text(verbatim: state)
    }

    private func stateKey(_ standing: SessionStanding) -> String.LocalizationValue {
        switch standing.state {
        case .complete:
            if let at = standing.completedAt { return "Done at \(format.time(at))" }
            return "Completed"
        case .active: return "\(standing.done) of \(standing.total)"
        case .idle: return "Not started"
        }
    }
}

/// A ring that fills as the session is read, with the session's symbol inside.
struct ProgressRing<Content: View>: View {
    let fraction: Double
    let tint: Color
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.2), lineWidth: 4)
            Circle()
                .trim(from: 0, to: max(0.001, fraction))
                .stroke(tint, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .opacity(fraction > 0 ? 1 : 0)
                .animation(.snappy, value: fraction)
            content
        }
        .frame(width: 44, height: 44)
        .accessibilityHidden(true)
    }
}

/// Cards shrink a little under the finger, as system cards do.
struct PressableCardStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.snappy(duration: 0.2), value: configuration.isPressed)
    }
}
