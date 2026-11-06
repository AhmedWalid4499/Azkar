import AzkarKit
import SwiftUI

/// Every saved conversation, the latest first. A swipe deletes one; it never runs at full stretch.
struct CompanionHistory: View {
    let model: CompanionModel
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let conversations = app.records.records.companion
        NavigationStack {
            List {
                if conversations.isEmpty {
                    ContentUnavailableView {
                        Label { Text(CL("No conversations yet")) } icon: { Image(systemName: "bubble.left.and.bubble.right") }
                    }
                }
                ForEach(conversations) { conversation in
                    Button {
                        model.open(conversation)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(verbatim: conversation.title ?? "")
                                .lineLimit(2)
                                .foregroundStyle(.primary)
                            Text(conversation.updatedAt, format: .dateTime.day().month().year().hour().minute())
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .swipeActions(allowsFullSwipe: false) {
                        Button(role: .destructive) { model.delete(conversation) } label: {
                            Label { Text(CL("Delete")) } icon: { Image(systemName: "trash") }
                        }
                    }
                }
            }
            .navigationTitle(Text(CL("Past conversations")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .appDirection()
    }
}
