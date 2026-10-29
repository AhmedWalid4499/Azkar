import SwiftUI

/// A calm compass dial: the card turns so north points north, and the Kaaba sits on its rim in
/// the Qibla's direction. The mark at the top is where the phone points. Never mirrored: east
/// stays on the right of north in Arabic too.
struct QiblaDial: View {
    /// Degrees clockwise from true north to the Kaaba.
    let bearing: Double
    /// The phone's heading without wrapping (0 for a north-up dial).
    let heading: Double
    let isAligned: Bool

    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            ZStack {
                Circle()
                    .fill(.background.secondary)
                Circle()
                    .strokeBorder(isAligned ? Color.green : Color.secondary.opacity(0.35), lineWidth: isAligned ? 3 : 1)
                card(side: side)
                    .rotationEffect(.degrees(-heading))
                Circle()
                    .fill(Color.primary)
                    .frame(width: 8, height: 8)
                PhoneIndex(isAligned: isAligned)
                    .frame(width: 18, height: 12)
                    .offset(y: -side / 2 - 10)
            }
            .frame(width: side, height: side)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .padding(.top, 16)
        .environment(\.layoutDirection, .leftToRight)
        .animation(.smooth(duration: 0.25), value: isAligned)
    }

    /// What turns with the phone: ticks, cardinal letters and the Qibla needle.
    private func card(side: CGFloat) -> some View {
        ZStack {
            Ticks()
                .padding(side * 0.03)
            ForEach(Cardinal.allCases, id: \.self) { point in
                Text(point.letter, tableName: "Qibla")
                    .font(.system(.headline, design: .rounded, weight: point == .north ? .bold : .semibold))
                    .foregroundStyle(point == .north ? Color.red : Color.secondary)
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    // Kept upright while the card turns.
                    .rotationEffect(.degrees(heading - point.degrees))
                    .offset(y: -side * 0.36)
                    .rotationEffect(.degrees(point.degrees))
            }
            Needle(isAligned: isAligned, side: side, upright: heading - bearing)
                .rotationEffect(.degrees(bearing))
        }
    }
}

private enum Cardinal: CaseIterable {
    case north, east, south, west

    var degrees: Double {
        switch self {
        case .north: 0
        case .east: 90
        case .south: 180
        case .west: 270
        }
    }

    var letter: LocalizedStringKey {
        switch self {
        case .north: "N"
        case .east: "E"
        case .south: "S"
        case .west: "W"
        }
    }
}

/// Tick marks every five degrees, longer every thirty.
private struct Ticks: View {
    var body: some View {
        Canvas { context, size in
            let radius = min(size.width, size.height) / 2
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            for step in 0..<72 {
                let degrees = Double(step) * 5
                let major = step % 6 == 0
                let length = radius * (major ? 0.09 : 0.045)
                let angle = degrees * .pi / 180
                let outer = CGPoint(x: center.x + radius * sin(angle), y: center.y - radius * cos(angle))
                let inner = CGPoint(x: center.x + (radius - length) * sin(angle), y: center.y - (radius - length) * cos(angle))
                var path = Path()
                path.move(to: inner)
                path.addLine(to: outer)
                let color: Color = step == 0 ? .red : (major ? .primary.opacity(0.7) : .secondary.opacity(0.5))
                context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: major ? 2 : 1, lineCap: .round))
            }
        }
        .accessibilityHidden(true)
    }
}

/// From the centre to the Kaaba on the rim.
private struct Needle: View {
    let isAligned: Bool
    let side: CGFloat
    /// Turns the Kaaba back so it stands upright on the screen whatever the needle's angle.
    let upright: Double

    var body: some View {
        let length = side * 0.27
        VStack(spacing: 4) {
            KaabaMark()
                .frame(width: side * 0.09, height: side * 0.09)
                .rotationEffect(.degrees(upright))
                .shadow(color: isAligned ? .green.opacity(0.6) : .clear, radius: 8)
            Capsule()
                .fill(isAligned ? Color.green : Color.accentColor)
                .frame(width: 4, height: length)
        }
        .offset(y: -(length + side * 0.09) / 2 - 2)
    }
}

/// The Kaaba, drawn simply: a dark cube with its gold band.
private struct KaabaMark: View {
    var body: some View {
        GeometryReader { proxy in
            let side = proxy.size.width
            ZStack(alignment: .top) {
                RoundedRectangle(cornerRadius: side * 0.12, style: .continuous)
                    .fill(Color(white: 0.1))
                Rectangle()
                    .fill(Color(red: 0.83, green: 0.68, blue: 0.3))
                    .frame(height: side * 0.14)
                    .offset(y: side * 0.24)
            }
            .clipShape(RoundedRectangle(cornerRadius: side * 0.12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: side * 0.12, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.45), lineWidth: 1)
            )
        }
        .accessibilityHidden(true)
    }
}

/// The mark above the dial: where the top of the phone points.
private struct PhoneIndex: View {
    let isAligned: Bool

    var body: some View {
        Triangle()
            .fill(isAligned ? Color.green : Color.primary)
            .accessibilityHidden(true)
    }
}

private nonisolated struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

#Preview("Turning") {
    QiblaDial(bearing: 135, heading: 100, isAligned: false)
        .padding(40)
}

#Preview("Aligned") {
    QiblaDial(bearing: 135, heading: 134, isAligned: true)
        .padding(40)
}
