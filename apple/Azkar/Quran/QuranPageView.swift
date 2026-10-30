import AzkarKit
import SwiftUI
import UIKit

/// The mushaf's paper: warm in the light, near black in the dark.
extension UIColor {
    static let quranPaper = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.06, alpha: 1)
            : UIColor(red: 0.99, green: 0.975, blue: 0.93, alpha: 1)
    }
    static let quranInk = UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(white: 0.93, alpha: 1) : UIColor(white: 0.08, alpha: 1)
    }
}

extension Color {
    static let quranPaper = Color(uiColor: .quranPaper)
}

/// One page of the mushaf. Drawn once and kept by the system, so swiping only moves it.
struct QuranPageCanvas: UIViewRepresentable {
    let page: Int

    func makeUIView(context: Context) -> QuranPageUIView { QuranPageUIView(page: page) }

    func updateUIView(_ view: QuranPageUIView, context: Context) { view.page = page }
}

final class QuranPageUIView: UIView {
    var page: Int {
        didSet {
            guard page != oldValue else { return }
            layoutResult = nil
            setNeedsDisplay()
            requestLayout()
        }
    }

    private var layoutResult: QuranPageLayout?
    private var requestedSize: CGSize?
    private var request: Task<Void, Never>?

    init(page: Int) {
        self.page = page
        super.init(frame: .zero)
        backgroundColor = .quranPaper
        contentMode = .redraw
        layer.drawsAsynchronously = true
        isAccessibilityElement = true
        accessibilityTraits = .staticText
        accessibilityLanguage = "ar"
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (view: QuranPageUIView, _: UITraitCollection) in
            view.setNeedsDisplay()
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("Not used from a storyboard") }

    deinit { request?.cancel() }

    override var accessibilityLabel: String? {
        get { QuranMushaf.bundled.ayat(onPage: page).map(\.text).joined(separator: " ") }
        set {}
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != requestedSize { requestLayout() }
    }

    private func requestLayout() {
        let page = page
        let size = bounds.size
        guard size.width > 0, size.height > 0 else { return }
        requestedSize = size
        request?.cancel()
        request = Task { [weak self] in
            let layout = await QuranLayouts.shared.layout(page: page, size: size)
            guard let self, !Task.isCancelled, self.page == page, self.bounds.size == size else { return }
            self.layoutResult = layout
            self.setNeedsDisplay()
        }
    }

    override func draw(_ rect: CGRect) {
        guard let layoutResult, let context = UIGraphicsGetCurrentContext() else { return }
        let tint = UIColor(named: "AccentColor") ?? .systemGreen
        layoutResult.draw(in: context, ink: UIColor.quranInk.resolvedColor(with: traitCollection).cgColor, tint: tint.resolvedColor(with: traitCollection).cgColor)
    }
}
