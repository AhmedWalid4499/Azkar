import AzkarKit
import SwiftUI

/// The Azkar tab's way into Riyad as-Salihin.
struct HadithLibraryRow: View {
    var body: some View {
        NavigationLink(value: ReadingDestination.hadithLibrary) {
            HStack(spacing: 14) {
                ReadingProgressBadge(fraction: 0, systemImage: "text.book.closed", tint: .teal)
                VStack(alignment: .leading, spacing: 3) {
                    Text(H("Riyad as-Salihin"))
                        .font(.headline)
                    Text(H("The hadith collection of Imam an-Nawawi, to read and search"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
        .accessibilityElement(children: .combine)
    }
}
