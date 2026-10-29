import AzkarKit
import SwiftUI

/// The quiet end of a session.
struct ReaderCompletionView: View {
    let session: AzkarSession
    let onDone: () -> Void
    let onReview: () -> Void
    @Environment(\.readingLocale) private var locale
    @AccessibilityFocusState private var titleFocused: Bool
    @State private var appeared = false

    /// Interface wording, as the website's completion screen.
    static let acceptanceDua = "تَقَبَّلَ اللهُ مِنَّا وَمِنْكُمْ"

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Color.readingDone)
                    .symbolEffect(.bounce, value: appeared)
                    .accessibilityHidden(true)
                    .padding(.top, 48)

                session.readingCompletionTitle
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($titleFocused)

                Text(verbatim: Self.acceptanceDua)
                    .font(.custom(RecitationFont.regular, size: 32, relativeTo: .title))
                    .lineSpacing(10)
                    .multilineTextAlignment(.center)
                    .environment(\.layoutDirection, .rightToLeft)

                if !locale.isArabic {
                    Text("May Allah accept it from us and from you", tableName: "Reading")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 12) {
                    Button(action: onDone) {
                        Text("Done", tableName: "Reading").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    Button(action: onReview) {
                        Text("Review again", tableName: "Reading").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                }
                .controlSize(.large)
                .padding(.top, 16)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            appeared = true
            titleFocused = true
        }
    }
}

#Preview {
    ReaderCompletionView(session: .morning, onDone: {}, onReview: {})
}
