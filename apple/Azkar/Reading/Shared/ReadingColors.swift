import SwiftUI
import UIKit

extension Color {
    /// "Done" text and marks: a green that reads on the grouped background in light and dark.
    static let readingDone = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.systemGreen
            : UIColor(red: 30 / 255, green: 120 / 255, blue: 58 / 255, alpha: 1)
    })
}
