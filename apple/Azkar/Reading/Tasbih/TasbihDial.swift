import SwiftUI

/// The tasbih counter's tap area: a large glass disc with the count, and a ring that fills
/// towards the target and starts again with each round.
struct TasbihDial: View {
    let current: Int
    let target: Int?
    let onTap: () -> Void
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let round = target.map { current % $0 } ?? 0
        let reached = target.map { current > 0 && current % $0 == 0 } ?? false
        let rounds = target.map { current / $0 } ?? 0
        let progress = target.map { reached ? 1 : Double(round) / Double($0) } ?? 0

        Button(action: onTap) {
            ZStack {
                if target != nil {
                    ReadingRing(progress: progress, color: reached ? Color.readingDone : .accentColor, track: Color.accentColor.opacity(0.15), lineWidth: 10)
                        .animation(.smooth(duration: 0.2), value: progress)
                        .padding(9)
                }
                VStack(spacing: 6) {
                    Text(verbatim: locale.number(current))
                        .font(.system(size: 76, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.4)
                        .lineLimit(1)
                        .contentTransition(.numericText(value: Double(current)))
                    caption(round: round, reached: reached)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    if rounds > 0 {
                        Text("\(rounds) rounds done", tableName: "Reading")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.readingDone)
                    }
                }
                .padding(36)
            }
            .frame(maxWidth: 340)
            .aspectRatio(1, contentMode: .fit)
            .contentShape(.circle)
        }
        .buttonStyle(DialStyle())
        .glassEffect(.regular.interactive(), in: .circle)
        .accessibilityLabel(label(round: round))
        .accessibilityHint(Text("Double-tap to count", tableName: "Reading"))
        .animation(.smooth(duration: 0.2), value: reached)
    }

    private func caption(round: Int, reached: Bool) -> Text {
        guard let target else { return Text("Tap to count", tableName: "Reading") }
        if reached { return Text("\(locale.number(target)) reached", tableName: "Reading") }
        if current < target { return Text("of \(locale.number(target))", tableName: "Reading") }
        return Text("\(locale.number(round)) of \(locale.number(target)) in this round", tableName: "Reading")
    }

    private func label(round: Int) -> Text {
        guard let target else { return Text("Tap to count: \(locale.number(current))", tableName: "Reading") }
        if current <= target {
            return Text("Tap to count: \(locale.number(current)) of \(locale.number(target))", tableName: "Reading")
        }
        return Text("Tap to count: \(locale.number(current)), \(locale.number(round)) of \(locale.number(target)) in this round", tableName: "Reading")
    }
}

/// A gentle press, like a bead under the thumb.
private struct DialStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.snappy(duration: 0.12), value: configuration.isPressed)
    }
}

#Preview {
    TasbihDial(current: 40, target: 33) {}
        .padding()
}
