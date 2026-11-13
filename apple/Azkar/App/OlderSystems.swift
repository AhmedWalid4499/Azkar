import SwiftUI

// The app runs from iOS 18. What iOS 26 added (Liquid Glass, the system's close and confirm
// buttons, a tab bar that shrinks on scroll) is used where it exists, with the iOS 18 look before.

extension View {
    /// The prominent glass button; a filled button before iOS 26.
    @ViewBuilder func prominentButtonStyle() -> some View {
        if #available(iOS 26.0, *) { buttonStyle(.glassProminent) } else { buttonStyle(.borderedProminent) }
    }

    /// The glass button; a tinted button before iOS 26.
    @ViewBuilder func glassButtonStyle() -> some View {
        if #available(iOS 26.0, *) { buttonStyle(.glass) } else { buttonStyle(.bordered) }
    }

    /// Interactive glass in a circle; a material circle before iOS 26.
    @ViewBuilder func glassCircle() -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.interactive(), in: .circle)
        } else {
            background(.regularMaterial, in: .circle)
        }
    }

    /// Glass in a capsule; a material capsule before iOS 26.
    @ViewBuilder func glassCapsule() -> some View {
        if #available(iOS 26.0, *) { glassEffect() } else { background(.regularMaterial, in: .capsule) }
    }

    /// The subtitle under a navigation title, from iOS 26.
    @ViewBuilder func navigationSubtitleIfAvailable(_ subtitle: Text) -> some View {
        if #available(iOS 26.0, *) { navigationSubtitle(subtitle) } else { self }
    }

    /// The tab bar shrinks while scrolling down, from iOS 26.
    @ViewBuilder func tabBarMinimizesOnScroll() -> some View {
        if #available(iOS 26.0, *) { tabBarMinimizeBehavior(.onScrollDown) } else { self }
    }
}

/// A sheet's close, confirm or cancel button: the system's own from iOS 26 (drawn as an icon), and
/// before it the same button with its word ("Done", "Cancel").
struct SheetButton<Label: View>: View {
    enum Kind { case close, confirm, cancel }

    let kind: Kind
    let action: () -> Void
    let label: Label?

    init(_ kind: Kind, action: @escaping () -> Void) where Label == EmptyView {
        self.kind = kind
        self.action = action
        label = nil
    }

    init(_ kind: Kind, action: @escaping () -> Void, @ViewBuilder label: () -> Label) {
        self.kind = kind
        self.action = action
        self.label = label()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            let role: ButtonRole = switch kind {
            case .close: .close
            case .confirm: .confirm
            case .cancel: .cancel
            }
            if let label {
                Button(role: role, action: action) { label }
            } else {
                Button(role: role, action: action)
            }
        } else {
            switch kind {
            case .cancel:
                Button(role: .cancel, action: action) { Text("Cancel", tableName: "App") }
            case .close, .confirm:
                Button(action: action) {
                    if let label { label } else { Text("Done", tableName: "App") }
                }
            }
        }
    }
}
