import AzkarKit
import CoreText
import UIKit

/// One mushaf page set in type, ready to draw: glyphs at their places on the page. Worked out
/// away from the main actor and cached (see `QuranLayouts`), so swiping never waits for it.
///
/// Each page is sized to fill its space as far as it can without the type growing past a common
/// size, so pages read alike; lines are justified, and spare height goes between them.
nonisolated struct QuranPageLayout: @unchecked Sendable {
    /// Immutable after `make`; CTFont is safe to read from any thread.
    struct GlyphRun {
        let font: CTFont
        let glyphs: [CGGlyph]
        let positions: [CGPoint]
    }

    let size: CGSize
    let fontSize: CGFloat
    private var inkRuns: [GlyphRun] = []
    private var tintRuns: [GlyphRun] = []
    private var bands: [CGRect] = []

    private static let margin: CGFloat = 16
    private static let widestText: CGFloat = 600
    /// Line height in ems: tight enough to read as a mushaf, clear of the marks above and below.
    private static let lineHeight: CGFloat = 1.95
    private static let bandHeight: CGFloat = 1.25
    private static let baselineInLine: CGFloat = 0.68
    private static let pauseMarkDrop: CGFloat = 0.42
    private static let spareHeightPerLine: CGFloat = 0.5
    private static let smallestSize: CGFloat = 10
    /// A paragraph's last line is stretched only when it nearly fills the width.
    private static let justifiedLastLine: CGFloat = 0.82

    static func make(page: Int, mushaf: QuranMushaf, size: CGSize) -> QuranPageLayout {
        let width = min(size.width - margin * 2, widestText)
        let blocks = QuranTypeset.blocks(of: page, mushaf: mushaf)
        let largest = width / 16.5
        var fontSize = largest
        if slots(blocks, fontSize: largest, width: width) * largest * lineHeight > size.height {
            var low = smallestSize, high = largest
            for _ in 0..<9 {
                let middle = (low + high) / 2
                if slots(blocks, fontSize: middle, width: width) * middle * lineHeight <= size.height { low = middle } else { high = middle }
            }
            fontSize = low
        }
        var layout = QuranPageLayout(size: size, fontSize: fontSize)
        layout.place(blocks, width: width)
        return layout
    }

    private init(size: CGSize, fontSize: CGFloat) {
        self.size = size
        self.fontSize = fontSize
    }

    /// How many lines the blocks take, a sura band counting for a little more than one.
    private static func slots(_ blocks: [QuranTypeset.Block], fontSize: CGFloat, width: CGFloat) -> CGFloat {
        blocks.reduce(0) { total, block in
            switch block {
            case .band: total + bandHeight
            case .basmala: total + 1
            case let .paragraph(text): total + CGFloat(QuranTypeset.lines(text, fontSize: fontSize, width: width).count)
            }
        }
    }

    private mutating func place(_ blocks: [QuranTypeset.Block], width: CGFloat) {
        let left = (size.width - width) / 2
        let count = Self.slots(blocks, fontSize: fontSize, width: width)
        let natural = fontSize * Self.lineHeight
        let spare = max(0, size.height - count * natural) / max(count, 1)
        let step = natural + min(spare, fontSize * Self.spareHeightPerLine)
        var top = size.height - (size.height - count * step) / 2
        for block in blocks {
            switch block {
            case let .band(title):
                let height = step * Self.bandHeight
                let band = CGRect(x: left, y: top - height + 6, width: width, height: height - 12)
                bands.append(band)
                let line = CTLineCreateWithAttributedString(QuranTypeset.bandTitle(title, fontSize: fontSize))
                let lineWidth = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
                tintRuns += Self.runs(line, origin: CGPoint(x: band.midX - lineWidth / 2, y: band.midY - fontSize * 0.35), fontSize: fontSize)
                top -= height
            case let .basmala(text):
                if let line = QuranTypeset.lines(text, fontSize: fontSize, width: width).first {
                    inkRuns += Self.runs(line.line, origin: CGPoint(x: left + (width - line.width) / 2, y: top - step * Self.baselineInLine), fontSize: fontSize)
                }
                top -= step
            case let .paragraph(text):
                for line in QuranTypeset.lines(text, fontSize: fontSize, width: width) {
                    let baseline = top - step * Self.baselineInLine
                    if !line.isLast || line.width > width * Self.justifiedLastLine,
                       let justified = CTLineCreateJustifiedLine(line.line, 1, Double(width)) {
                        inkRuns += Self.runs(justified, origin: CGPoint(x: left, y: baseline), fontSize: fontSize, text: line.text)
                    } else {
                        inkRuns += Self.runs(line.line, origin: CGPoint(x: left + width - line.width, y: baseline), fontSize: fontSize, text: line.text)
                    }
                    top -= step
                }
            }
        }
    }

    /// A line's glyphs at their places on the page. Pause marks are brought down to their word:
    /// the font sets them for the tallest letters, which leaves them nearer the line above.
    private static func runs(_ line: CTLine, origin: CGPoint, fontSize: CGFloat, text: NSString? = nil) -> [GlyphRun] {
        (CTLineGetGlyphRuns(line) as? [CTRun] ?? []).map { run in
            let count = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating: 0, count: count)
            var positions = [CGPoint](repeating: .zero, count: count)
            var indices = [CFIndex](repeating: 0, count: count)
            CTRunGetGlyphs(run, CFRange(), &glyphs)
            CTRunGetPositions(run, CFRange(), &positions)
            CTRunGetStringIndices(run, CFRange(), &indices)
            for index in 0..<count {
                let isMark = text.map { QuranTypesetting.isPauseMark(UInt32($0.character(at: indices[index]))) } ?? false
                positions[index].x += origin.x
                positions[index].y += origin.y - (isMark ? pauseMarkDrop * fontSize : 0)
            }
            let attributes = CTRunGetAttributes(run) as NSDictionary
            let font = attributes[kCTFontAttributeName] as! CTFont
            return GlyphRun(font: font, glyphs: glyphs, positions: positions)
        }
    }

    /// Draws into a context with its origin at the top left, as UIKit's are.
    func draw(in context: CGContext, ink: CGColor, tint: CGColor) {
        context.saveGState()
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        context.textMatrix = .identity
        context.setStrokeColor(tint)
        context.setLineWidth(1.2)
        for band in bands {
            context.addPath(CGPath(roundedRect: band, cornerWidth: 10, cornerHeight: 10, transform: nil))
        }
        context.strokePath()
        context.setFillColor(ink)
        draw(inkRuns, in: context)
        context.setFillColor(tint)
        draw(tintRuns, in: context)
        context.restoreGState()
    }

    private func draw(_ runs: [GlyphRun], in context: CGContext) {
        for run in runs {
            CTFontDrawGlyphs(run.font, run.glyphs, run.positions, run.glyphs.count, context)
        }
    }
}

/// Text to lines, for `QuranPageLayout`.
nonisolated enum QuranTypeset {
    static let textFont = "AmiriQuran-Regular"
    static let bandFont = "Amiri-Bold"

    enum Block {
        case band(String)
        case basmala(String)
        case paragraph(String)
    }

    struct Line {
        let line: CTLine
        let width: CGFloat
        let isLast: Bool
        /// The paragraph, for finding which glyphs are pause marks.
        let text: NSString
    }

    static func blocks(of page: Int, mushaf: QuranMushaf) -> [Block] {
        mushaf.content(ofPage: page).map { block in
            switch block {
            case let .suraHeader(sura): .band("سورة \(sura.name)")
            case let .basmala(text): .basmala(text)
            case let .ayat(ayat): .paragraph(QuranTypesetting.paragraph(ayat))
            }
        }
    }

    private static func rightToLeft() -> CTParagraphStyle {
        var direction = CTWritingDirection.rightToLeft
        return withUnsafeBytes(of: &direction) { bytes in
            var setting = CTParagraphStyleSetting(spec: .baseWritingDirection, valueSize: bytes.count, value: bytes.baseAddress!)
            return CTParagraphStyleCreate(&setting, 1)
        }
    }

    private static func attributed(_ text: String, font: String, size: CGFloat) -> NSAttributedString {
        NSAttributedString(string: text, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName(font as CFString, size, nil),
            NSAttributedString.Key(kCTParagraphStyleAttributeName as String): rightToLeft(),
        ])
    }

    static func bandTitle(_ title: String, fontSize: CGFloat) -> NSAttributedString {
        attributed(title, font: bandFont, size: fontSize * 1.05)
    }

    /// Breaks a paragraph into lines; `width` of each leaves out its trailing space.
    static func lines(_ text: String, fontSize: CGFloat, width: CGFloat) -> [Line] {
        let string = attributed(text, font: textFont, size: fontSize)
        let typesetter = CTTypesetterCreateWithAttributedString(string)
        var lines: [Line] = []
        var start = 0
        while start < string.length {
            let length = CTTypesetterSuggestLineBreak(typesetter, start, Double(width))
            guard length > 0 else { break }
            let line = CTTypesetterCreateLine(typesetter, CFRange(location: start, length: length))
            let lineWidth = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil)) - CGFloat(CTLineGetTrailingWhitespaceWidth(line))
            lines.append(Line(line: line, width: lineWidth, isLast: start + length >= string.length, text: string.string as NSString))
            start += length
        }
        return lines
    }
}

/// The pages laid out so far, the most recent kept. Each is worked out once, off the main actor.
actor QuranLayouts {
    static let shared = QuranLayouts()

    private struct Key: Hashable {
        let page: Int
        let width: CGFloat
        let height: CGFloat
    }

    private static let kept = 16
    private var pages: [Key: QuranPageLayout] = [:]
    private var order: [Key] = []
    private var lastSize: CGSize?

    func layout(page: Int, size: CGSize) -> QuranPageLayout {
        lastSize = size
        return made(page: page, size: size)
    }

    /// Readies the pages either side of `page`, so a swipe finds them done.
    func prepare(around page: Int) {
        guard let lastSize else { return }
        for near in [page + 1, page - 1, page + 2] where QuranMushaf.pages.contains(near) {
            _ = made(page: near, size: lastSize)
        }
    }

    private func made(page: Int, size: CGSize) -> QuranPageLayout {
        let key = Key(page: page, width: size.width, height: size.height)
        if let done = pages[key] { return done }
        let layout = QuranPageLayout.make(page: page, mushaf: .bundled, size: size)
        pages[key] = layout
        order.append(key)
        if order.count > Self.kept { pages[order.removeFirst()] = nil }
        return layout
    }
}
