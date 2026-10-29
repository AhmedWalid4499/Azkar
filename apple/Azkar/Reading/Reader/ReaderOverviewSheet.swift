import AzkarKit
import SwiftUI

/// Every dhikr of the session with how far each got, to jump to one; and "Start over".
struct ReaderOverviewSheet: View {
    let session: AzkarSession
    let model: ReaderModel
    let onJump: (Int) -> Void
    let onStartOver: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.readingLocale) private var locale
    @State private var confirmsStartOver = false

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    ForEach(Array(model.items.enumerated()), id: \.element.id) { position, dhikr in
                        row(position, dhikr)
                            .id(position)
                    }
                    Section {
                        Button(role: .destructive) {
                            confirmsStartOver = true
                        } label: {
                            Label { Text("Start over", tableName: "Reading") } icon: { Image(systemName: "arrow.counterclockwise") }
                        }
                        .disabled(model.counts.values.allSatisfy { $0 <= 0 })
                    }
                }
                .onAppear { proxy.scrollTo(model.index, anchor: .center) }
            }
            .navigationTitle(Text("All azkar", tableName: "Reading"))
            .navigationSubtitle(Text("\(model.doneCount) of \(model.items.count) done", tableName: "Reading"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
            .confirmationDialog(Text("Start this reading over?", tableName: "Reading"), isPresented: $confirmsStartOver, titleVisibility: .visible) {
                Button(role: .destructive, action: onStartOver) {
                    Text("Start over", tableName: "Reading")
                }
            } message: {
                Text("This clears today’s counts for \(session.readingTitle) so you can begin again.", tableName: "Reading")
            }
        }
    }

    private func row(_ position: Int, _ dhikr: Dhikr) -> some View {
        let count = model.count(of: dhikr)
        let target = ReadingProgress.target(of: dhikr)
        let done = count >= target
        return Button {
            onJump(position)
        } label: {
            HStack(spacing: 12) {
                Text(verbatim: locale.number(position + 1))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 24)
                Text(verbatim: RecitationText.snippet(dhikr.arabic))
                    .font(.custom(RecitationFont.regular, size: 19, relativeTo: .body))
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .environment(\.layoutDirection, .rightToLeft)
                    .foregroundStyle(.primary)
                if done {
                    Label { Text("Done", tableName: "Reading") } icon: { Image(systemName: "checkmark.circle.fill") }
                        .labelStyle(.iconOnly)
                        .foregroundStyle(Color.readingDone)
                        .font(.title3)
                } else {
                    Text(verbatim: "\(locale.number(count)) / \(locale.number(target))")
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(.plain)
        .contentShape(.rect)
        .listRowBackground(position == model.index ? Color.accentColor.opacity(0.12) : nil)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(position == model.index ? .isSelected : [])
    }
}
