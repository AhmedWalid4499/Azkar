import AzkarCore
import SwiftUI

/// A tasbih counter: a tap or a turn of the crown adds one, with a tap on the wrist, and the round
/// of 33 starts over by itself. What is counted goes on the iPhone's free count for the day.
struct WatchTasbihView: View {
    let store: WatchStore
    private static let round = 33

    @AppStorage("tasbihRound") private var inRound = 0
    @State private var crown = 0.0
    @State private var counted = 0
    @FocusState private var hasCrown: Bool

    var body: some View {
        Button(action: count) {
            VStack(spacing: 4) {
                Text(inRound, format: .number)
                    .font(.system(size: 64, weight: .semibold, design: .rounded).monospacedDigit())
                    .contentTransition(.numericText())
                ProgressView(value: Double(inRound), total: Double(Self.round))
                    .tint(.accentColor)
                Text("Today: \(store.tasbihToday(at: .now))", tableName: "Watch")
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("Tasbih", tableName: "Watch"))
        .accessibilityValue(Text(inRound, format: .number))
        .focusable()
        .focused($hasCrown)
        .digitalCrownRotation($crown, from: 0, through: 1_000_000, by: 1, sensitivity: .low, isContinuous: true, isHapticFeedbackEnabled: true)
        .onChange(of: crown) { before, after in
            if after > before { count() }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: counted)
        .sensoryFeedback(.success, trigger: inRound) { _, value in value == 0 }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    inRound = 0
                } label: {
                    Label { Text("Start the round over", tableName: "Watch") } icon: { Image(systemName: "arrow.counterclockwise") }
                }
                .disabled(inRound == 0)
            }
        }
        .onAppear { hasCrown = true }
    }

    private func count() {
        counted += 1
        withAnimation(.snappy(duration: 0.15)) {
            inRound = (inRound + 1) % Self.round
        }
        store.countTasbih(at: .now)
    }
}
