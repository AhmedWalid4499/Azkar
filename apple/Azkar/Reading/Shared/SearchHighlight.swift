import AzkarKit
import SwiftUI

extension AttributedString {
    /// A search result's text with the words found tinted and set on a soft wash of the accent colour.
    init(searchSegments segments: [ArabicSearch.Segment]) {
        self.init()
        for segment in segments {
            var piece = AttributedString(segment.text)
            if segment.isMatch {
                piece.foregroundColor = .accentColor
                piece.backgroundColor = Color.accentColor.opacity(0.16)
            }
            append(piece)
        }
    }
}
