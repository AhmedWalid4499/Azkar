import SwiftUI

/// A progress ring that fills from the top: clockwise in a left-to-right interface,
/// anticlockwise in a right-to-left one.
struct ReadingRing: View {
    let progress: Double
    let color: Color
    var track: Color
    var lineWidth: CGFloat
    @Environment(\.layoutDirection) private var layoutDirection

    init(progress: Double, color: Color, track: Color? = nil, lineWidth: CGFloat) {
        self.progress = progress
        self.color = color
        self.track = track ?? color.opacity(0.18)
        self.lineWidth = lineWidth
    }

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        // Drawn left to right, then mirrored as a whole for right-to-left.
        .environment(\.layoutDirection, .leftToRight)
        .scaleEffect(x: layoutDirection == .rightToLeft ? -1 : 1)
        .accessibilityHidden(true)
    }
}
