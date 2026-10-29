import SwiftUI

/// A value and the line under it at the end of a row; at accessibility text sizes, where the
/// row stacks under its label, they line up with the label instead.
struct TrackerValueStack<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.dynamicTypeSize) private var size

    var body: some View {
        VStack(alignment: size.isAccessibilitySize ? .leading : .trailing, spacing: 2) {
            content
        }
        .monospacedDigit()
    }
}

/// Side by side, or one under the other at accessibility text sizes.
struct TrackerAdaptiveStack<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.dynamicTypeSize) private var size

    var body: some View {
        let layout = size.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 12))
        layout { content }
    }
}
