import AzkarKit
import SwiftUI

/// The reader of one session: one dhikr per page, swiped through in reading order (leftwards in
/// a right-to-left interface), with the counter at the bottom and the session's progress in the
/// navigation bar. Created afresh for each session and day.
struct ReaderView: View {
    @State private var model: ReaderModel
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    init(session: AzkarSession, day: DayKey, context: ReadingContext) {
        _model = State(initialValue: ReaderModel(session: session, day: day, context: context))
    }

    var body: some View {
        let settings = context.reader
        Group {
            if model.items.isEmpty {
                ContentUnavailableView {
                    Label { Text("No azkar are available yet.", tableName: "Reading") } icon: { Image(systemName: "book.closed") }
                }
            } else if model.isComplete {
                ReaderCompletionView(session: model.session, onDone: { dismiss() }, onReview: { model.review() })
                    .transition(.opacity)
            } else {
                // The text stops above the counter rather than running under it.
                VStack(spacing: 0) {
                    pager(settings)
                    dock(settings)
                }
                .transition(.opacity)
            }
        }
        .toolbar { toolbar }
        .navigationTitle(model.session.readingTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $model.isOverviewShown) {
            ReaderOverviewSheet(session: model.session, model: model, onJump: { position in
                model.isOverviewShown = false
                model.go(to: position, reduceMotion: reduceMotion)
            }, onStartOver: { model.startOver() })
            .presentationDetents([.medium, .large])
        }
        .sensoryFeedback(.impact(weight: .light), trigger: model.ticks) { _, _ in settings.haptics }
        .sensoryFeedback(.success, trigger: model.completions) { _, _ in settings.haptics }
        .keepsScreenAwake(settings.keepAwake && !model.isComplete)
        .onDisappear { model.cancelAdvance() }
        .onChange(of: context.records.isLoaded) { model.resumeIfLoaded() }
        #if DEBUG
        .task {
            await ReadingDebug.runScript([
                "tap": { model.primary(settings: settings, reduceMotion: reduceMotion, announce: announce) },
                "undo": { model.undo() },
                "markall": { model.markAllDone(settings: settings, reduceMotion: reduceMotion, announce: announce) },
                "next": { model.go(to: model.index + 1, reduceMotion: reduceMotion) },
                "prev": { model.go(to: model.index - 1, reduceMotion: reduceMotion) },
                "overview": { model.isOverviewShown = true },
                "close": { model.isOverviewShown = false },
                "startover": { model.startOver() },
            ])
        }
        #endif
    }

    private func pager(_ settings: ReaderSettings) -> some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(Array(model.items.enumerated()), id: \.offset) { position, dhikr in
                    DhikrPageView(dhikr: dhikr, position: position + 1, total: model.items.count, settings: settings)
                        .containerRelativeFrame(.horizontal)
                        .id(position)
                }
            }
            .scrollTargetLayout()
        }
        #if DEBUG
        // `-ReadingPeek YES` lets the neighbouring pages show at the edges, to check their order.
        .contentMargins(.horizontal, UserDefaults.standard.bool(forKey: "ReadingPeek") ? 48 : 0, for: .scrollContent)
        #endif
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $model.page)
        .scrollIndicators(.hidden)
        .onChange(of: model.page) { model.pageChanged() }
    }

    private func dock(_ settings: ReaderSettings) -> some View {
        let dhikr = model.current
        let count = dhikr.map(model.count(of:)) ?? 0
        let target = dhikr.map(ReadingProgress.target(of:)) ?? 1
        return CounterDock(
            count: count,
            target: target,
            sessionDone: model.isSessionDone,
            canGoPrevious: model.index > 0,
            canGoNext: model.index < model.items.count - 1,
            onCount: { model.primary(settings: settings, reduceMotion: reduceMotion, announce: announce) },
            onUndo: { model.undo() },
            onMarkAll: { model.markAllDone(settings: settings, reduceMotion: reduceMotion, announce: announce) },
            onPrevious: { model.go(to: model.index - 1, reduceMotion: reduceMotion) },
            onNext: { model.go(to: model.index + 1, reduceMotion: reduceMotion) }
        )
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if !model.items.isEmpty && !model.isComplete {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 4) {
                    model.session.readingTitle
                        .font(.headline)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        ProgressView(value: model.fraction)
                            .frame(width: 72)
                            .animation(.smooth, value: model.fraction)
                        Text("\(locale.number(model.index + 1)) of \(locale.number(model.items.count))", tableName: "Reading")
                            .font(.caption2.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(model.session.readingTitle)
                .accessibilityValue(Text("Dhikr \(model.index + 1) of \(model.items.count), \(model.doneCount) done", tableName: "Reading"))
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    model.isOverviewShown = true
                } label: {
                    Label { Text("All azkar", tableName: "Reading") } icon: { Image(systemName: "list.bullet") }
                }
            }
        }
    }

    private func announce(_ dhikr: Dhikr, _ position: Int) {
        let text = locale.string(LocalizedStringResource("Dhikr \(position + 1) of \(model.items.count) completed", table: "Reading"))
        AccessibilityNotification.Announcement(text).post()
    }
}

#Preview("Reader") {
    ReadingPreview { ReaderPreview() }
}

private struct ReaderPreview: View {
    @Environment(ReadingContext.self) private var context

    var body: some View {
        ReaderView(session: .morning, day: DayKey(.now, in: .current), context: context)
    }
}
