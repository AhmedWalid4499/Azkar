import AzkarKit
import SwiftUI

/// The tasbih counter: a preset dhikr or a free count, a big area to tap, a target that signals
/// each round, undo, reset, and what was counted today and ever.
struct TasbihView: View {
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale
    @State private var model: TasbihModel
    @State private var choosesPreset = false
    @State private var confirmsReset = false
    @State private var editsCustomTarget = false

    init(context: ReadingContext) {
        _model = State(initialValue: TasbihModel(context: context))
    }

    var body: some View {
        let settings = context.reader
        TimelineView(.everyMinute) { timeline in
            let day = ReadingClock(now: timeline.date, settings: context.settings.settings).tasbihDay
            let current = model.current(on: day)
            VStack(spacing: 0) {
                ScrollView {
                    VStack(spacing: 16) {
                        chosen(settings)
                        stats(day: day)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(maxHeight: .infinity)

                TasbihDial(current: current, target: settings.tasbihTarget) {
                    model.count(on: day)
                }
                .padding(.horizontal, 32)

                tools(day: day, current: current, target: settings.tasbihTarget)
                    .padding(.vertical, 16)
            }
            .confirmationDialog(Text("Reset the counter?", tableName: "Reading"), isPresented: $confirmsReset, titleVisibility: .visible) {
                Button(role: .destructive) { model.reset(on: day) } label: { Text("Reset", tableName: "Reading") }
            } message: {
                Text("The counter goes back to 0. Today’s total of \(locale.number(model.today(on: day))) stays recorded.", tableName: "Reading")
            }
        }
        .navigationTitle(Text("Tasbih", tableName: "Reading"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $choosesPreset) {
            TasbihPresetSheet(presets: context.dataset.tasbihPresets, chosen: model.preset?.id,
                              showsTransliteration: ReaderSettings.resolve(settings.showTransliteration, languageCode: locale.languageCode)) { preset in
                model.choose(preset)
                choosesPreset = false
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $editsCustomTarget) {
            TasbihCustomTargetSheet(target: settings.tasbihTarget) { model.setTarget($0) }
                .presentationDetents([.height(260)])
        }
        .sensoryFeedback(.impact(weight: .light), trigger: model.ticks) { _, _ in settings.haptics }
        .sensoryFeedback(.success, trigger: model.reached) { _, _ in settings.haptics }
        .keepsScreenAwake(settings.keepAwake)
        #if DEBUG
        .task {
            let day = ReadingClock(now: .now, settings: context.settings.settings).tasbihDay
            await ReadingDebug.runScript([
                "tap": { model.count(on: day) },
                "undo": { model.undo(on: day) },
                "reset": { model.reset(on: day) },
                "presets": { choosesPreset = true },
                "close": { choosesPreset = false },
            ])
        }
        #endif
    }

    @ViewBuilder
    private func chosen(_ settings: ReaderSettings) -> some View {
        let presets = context.dataset.tasbihPresets
        VStack(spacing: 10) {
            if let preset = model.preset {
                RecitationView(text: preset.arabic, scale: settings.arabicScale, alignment: .center)
                if ReaderSettings.resolve(settings.showTransliteration, languageCode: locale.languageCode),
                   let transliteration = preset.transliteration, !transliteration.isEmpty {
                    Text(verbatim: transliteration)
                        .font(.body.italic())
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .environment(\.layoutDirection, .leftToRight)
                }
                if ReaderSettings.resolve(settings.showTranslation, languageCode: locale.languageCode) {
                    Text(verbatim: preset.translation)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .environment(\.layoutDirection, .leftToRight)
                }
            } else {
                Text("Free count", tableName: "Reading")
                    .font(.title2.bold())
                Text("Counting with no dhikr chosen", tableName: "Reading")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if !presets.isEmpty {
                Button { choosesPreset = true } label: {
                    Label { Text("Change", tableName: "Reading") } icon: { Image(systemName: "arrow.left.arrow.right") }
                }
                .buttonStyle(.glass)
                .accessibilityLabel(Text("Change what you are counting", tableName: "Reading"))
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func stats(day: DayKey) -> some View {
        HStack(spacing: 12) {
            stat(Text("Today", tableName: "Reading"), model.today(on: day))
            stat(Text("All time", tableName: "Reading"), model.lifetime)
        }
    }

    private func stat(_ title: Text, _ value: Int) -> some View {
        VStack(spacing: 2) {
            title
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(verbatim: locale.number(value))
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText(value: Double(value)))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(.fill.quaternary, in: .rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }

    private func tools(day: DayKey, current: Int, target: Int?) -> some View {
        HStack(spacing: 12) {
            Button { model.undo(on: day) } label: {
                Label { Text("Undo one count", tableName: "Reading") } icon: { Image(systemName: "arrow.uturn.backward") }
                    .labelStyle(.iconOnly)
                    .frame(width: 24, height: 24)
            }
            .disabled(current == 0)

            Menu {
                Picker(selection: Binding(get: { target ?? 0 }, set: { model.setTarget($0 == 0 ? nil : $0) })) {
                    ForEach(ReaderSettings.tasbihTargets, id: \.self) { value in
                        Text(verbatim: locale.number(value)).tag(value)
                    }
                    Text("No target", tableName: "Reading").tag(0)
                    if let target, !ReaderSettings.tasbihTargets.contains(target) {
                        Text(verbatim: locale.number(target)).tag(target)
                    }
                } label: {
                    Text("Target", tableName: "Reading")
                }
                Button { editsCustomTarget = true } label: {
                    Label { Text("Custom…", tableName: "Reading") } icon: { Image(systemName: "number") }
                }
            } label: {
                Label {
                    if let target {
                        Text("Target: \(locale.number(target))", tableName: "Reading")
                    } else {
                        Text("No target", tableName: "Reading")
                    }
                } icon: {
                    Image(systemName: "target")
                }
                .monospacedDigit()
                .frame(minHeight: 24)
            }

            Button { confirmsReset = true } label: {
                Label { Text("Reset", tableName: "Reading") } icon: { Image(systemName: "arrow.counterclockwise") }
                    .labelStyle(.iconOnly)
                    .frame(width: 24, height: 24)
            }
            .disabled(current == 0)
        }
        .buttonStyle(.glass)
        .controlSize(.large)
    }
}

#Preview("Tasbih") {
    ReadingPreview { TasbihPreview() }
}

private struct TasbihPreview: View {
    @Environment(ReadingContext.self) private var context

    var body: some View {
        TasbihView(context: context)
    }
}
