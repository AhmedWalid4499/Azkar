import AzkarKit
import SwiftUI

/// The controls at the bottom of the reader, within reach of the thumb: the big counter with
/// undo, "Mark all done" and the previous and next dhikr above it.
struct CounterDock: View {
    let count: Int
    let target: Int
    /// Every dhikr of the session is done: the counter then finishes.
    let sessionDone: Bool
    let canGoPrevious: Bool
    let canGoNext: Bool
    let onCount: () -> Void
    let onUndo: () -> Void
    let onMarkAll: () -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    @Environment(\.readingLocale) private var locale

    private var isDone: Bool { count >= target }

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Button(action: onPrevious) {
                    Label { Text("Previous dhikr", tableName: "Reading") } icon: { Image(systemName: "chevron.backward") }
                        .labelStyle(.iconOnly)
                        .frame(width: 24, height: 24)
                }
                .disabled(!canGoPrevious)

                Spacer(minLength: 0)

                Button(action: onUndo) {
                    Label { Text("Undo one count", tableName: "Reading") } icon: { Image(systemName: "arrow.uturn.backward") }
                        .labelStyle(.iconOnly)
                        .frame(width: 24, height: 24)
                }
                .disabled(count == 0)

                if target >= ReaderModel.markAllFrom && !isDone {
                    Button(action: onMarkAll) {
                        // The words when they fit, else the symbol alone (large text sizes).
                        ViewThatFits(in: .horizontal) {
                            markAllLabel.lineLimit(1).fixedSize()
                            markAllLabel.labelStyle(.iconOnly)
                        }
                        .frame(minHeight: 24)
                    }
                    .accessibilityLabel(Text("Mark all done", tableName: "Reading"))
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }

                Spacer(minLength: 0)

                Button(action: onNext) {
                    Label { Text("Next dhikr", tableName: "Reading") } icon: { Image(systemName: "chevron.forward") }
                        .labelStyle(.iconOnly)
                        .frame(width: 24, height: 24)
                }
                .disabled(!canGoNext)
            }
            .buttonStyle(.glass)
            .controlSize(.large)

            Button(action: onCount) {
                VStack(spacing: 2) {
                    HStack(spacing: 8) {
                        if isDone {
                            Image(systemName: "checkmark")
                                .transition(.scale.combined(with: .opacity))
                        }
                        Text(verbatim: "\(locale.number(count)) / \(locale.number(target))")
                            .contentTransition(.numericText(value: Double(count)))
                    }
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    .monospacedDigit()
                    hint
                        .font(.subheadline.weight(.medium))
                        .opacity(0.85)
                }
                .frame(maxWidth: .infinity, minHeight: 92)
            }
            .buttonStyle(.glassProminent)
            .buttonBorderShape(.roundedRectangle(radius: 32))
            // Deep enough in light and dark for the white label to read clearly.
            .tint(isDone ? Self.doneTint : Self.countTint)
            .accessibilityLabel(label)
            .accessibilityValue(Text("\(locale.number(count)) of \(locale.number(target))", tableName: "Reading"))
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        // The counter stays one thumb's reach whatever the text size; the page above grows.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .animation(.smooth(duration: 0.25), value: isDone)
    }

    static let countTint = Color(red: 14 / 255, green: 107 / 255, blue: 84 / 255)
    static let doneTint = Color(red: 30 / 255, green: 128 / 255, blue: 62 / 255)

    private var markAllLabel: some View {
        Label { Text("Mark all done", tableName: "Reading") } icon: { Image(systemName: "checkmark.circle") }
    }

    // Once the count is reached the same button moves on, so one thumb does everything.
    private var hint: Text {
        if !isDone { return Text("Tap to count", tableName: "Reading") }
        return sessionDone ? Text("Finish", tableName: "Reading") : Text("Next dhikr", tableName: "Reading")
    }

    private var label: Text {
        if !isDone { return Text("Tap to count: \(target - count) left", tableName: "Reading") }
        return sessionDone ? Text("Done. Finish", tableName: "Reading") : Text("Done. Next dhikr", tableName: "Reading")
    }
}

#Preview {
    VStack {
        Spacer()
        CounterDock(count: 3, target: 33, sessionDone: false, canGoPrevious: true, canGoNext: true,
                    onCount: {}, onUndo: {}, onMarkAll: {}, onPrevious: {}, onNext: {})
    }
}
