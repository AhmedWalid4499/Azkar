import AzkarKit
import SwiftUI

/// The companion: a conversation with Claude for comfort and advice in the religion, with duas and
/// verses shown as cards in the app's own verified text. Opened from Today.
struct CompanionScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model: CompanionModel
    @State private var draft = ""
    @State private var showsHistory = false
    @State private var showsKey = false
    @FocusState private var writing: Bool

    init(app: AppEnvironment) {
        _model = State(initialValue: CompanionModel(app: app))
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.hasKey {
                    chat
                } else {
                    CompanionKeyForm { model.hasKey = true }
                }
            }
            .navigationTitle(Text(CL("Companion")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                if model.hasKey {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            Button { model.startOver() } label: {
                                Label { Text(CL("New conversation")) } icon: { Image(systemName: "square.and.pencil") }
                            }
                            Button { showsHistory = true } label: {
                                Label { Text(CL("Past conversations")) } icon: { Image(systemName: "clock.arrow.circlepath") }
                            }
                            Button { showsKey = true } label: {
                                Label { Text(CL("Your API key")) } icon: { Image(systemName: "key") }
                            }
                        } label: {
                            Label { Text(CL("More")) } icon: { Image(systemName: "ellipsis") }
                        }
                    }
                }
            }
            .sheet(isPresented: $showsHistory) {
                CompanionHistory(model: model)
            }
            .sheet(isPresented: $showsKey) {
                NavigationStack {
                    CompanionKeyForm { showsKey = false }
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button(role: .close) { showsKey = false }
                            }
                        }
                }
                .appDirection()
            }
        }
        .appDirection()
        #if DEBUG
        .task { CompanionDemo.applyIfRequested(to: model) }
        #endif
    }

    private var chat: some View {
        ScrollViewReader { scroller in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if model.lines.isEmpty, model.unsent == nil {
                        CompanionWelcome { send($0) }
                    }
                    ForEach(model.lines) { line in
                        CompanionBubble(line: line).id(line.id)
                    }
                    if let unsent = model.unsent {
                        CompanionBubble(line: CompanionLine(id: -1, role: .person, text: unsent, cards: []))
                            .opacity(model.failure == nil ? 1 : 0.6)
                    }
                    if model.isReplying {
                        CompanionTyping()
                    }
                    if let failure = model.failure {
                        CompanionFailure(failure: failure, retry: model.retry) { showsKey = true }
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: model.lines.count) { withAnimation { scroller.scrollTo("end", anchor: .bottom) } }
            .onChange(of: model.isReplying) { withAnimation { scroller.scrollTo("end", anchor: .bottom) } }
            .safeAreaInset(edge: .bottom) { inputBar }
        }
    }

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField(text: $draft, axis: .vertical) {
                Text(CL("Write what’s on your heart"))
            }
            .lineLimit(1...6)
            .focused($writing)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .glassEffect(.regular, in: .rect(cornerRadius: 22))
            if model.isReplying {
                Button { model.stop() } label: {
                    Label { Text(CL("Stop")) } icon: { Image(systemName: "stop.circle.fill") }
                        .labelStyle(.iconOnly)
                        .font(.system(size: 34))
                }
            } else {
                Button { send(draft) } label: {
                    Label { Text(CL("Send")) } icon: { Image(systemName: "arrow.up.circle.fill") }
                        .labelStyle(.iconOnly)
                        .font(.system(size: 34))
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private func send(_ text: String) {
        model.send(text)
        draft = ""
    }
}

/// What the screen shows before the first message.
private struct CompanionWelcome: View {
    let send: (String) -> Void
    @Environment(\.locale) private var locale

    private let starters: [LocalizedStringResource] = [
        CL("I feel anxious and can’t calm down"),
        CL("I’m scared about something"),
        CL("I can’t sleep"),
        CL("I feel far from Allah"),
        CL("I lost someone"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "hands.sparkles.fill")
                .font(.largeTitle)
                .foregroundStyle(.indigo)
            Text(CL("As-salamu alaykum"))
                .font(.title2.bold())
            Text(CL("Tell me what’s on your heart. I’ll listen, and share duas and verses that may bring you calm, shown in the app’s own verified text."))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(starters.enumerated()), id: \.offset) { _, starter in
                    Button {
                        var resource = starter
                        resource.locale = locale
                        send(String(localized: resource))
                    } label: {
                        Text(starter)
                            .multilineTextAlignment(.leading)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                    }
                    .buttonStyle(.glass)
                }
            }
            Text(CL("Not a scholar or a doctor. If you are in danger, call your local emergency number now."))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// One message, with the cards the companion showed under it.
private struct CompanionBubble: View {
    let line: CompanionLine

    var body: some View {
        let mine = line.role == .person
        VStack(alignment: mine ? .trailing : .leading, spacing: 10) {
            if !line.text.isEmpty {
                Text(verbatim: line.text)
                    .textSelection(.enabled)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(mine ? AnyShapeStyle(Color.accentColor.opacity(0.18)) : AnyShapeStyle(.background.secondary),
                                in: .rect(cornerRadius: 18))
            }
            ForEach(Array(line.cards.enumerated()), id: \.offset) { _, card in
                CompanionCardView(card: card)
            }
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
        .padding(mine ? .leading : .trailing, 36)
    }
}

/// Shown while Claude is thinking about the reply.
private struct CompanionTyping: View {
    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(CL("Thinking…"))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.background.secondary, in: .rect(cornerRadius: 18))
        .accessibilityElement(children: .combine)
    }
}

private struct CompanionFailure: View {
    let failure: CompanionError
    let retry: () -> Void
    let changeKey: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label { Text(message) } icon: { Image(systemName: "exclamationmark.bubble").foregroundStyle(.orange) }
            HStack {
                if failure == .invalidKey {
                    Button(action: changeKey) { Text(CL("Change key")) }
                        .buttonStyle(.bordered)
                }
                if failure != .declined {
                    Button(action: retry) { Text(CL("Try again")) }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: .rect(cornerRadius: 18))
    }

    private var message: LocalizedStringResource {
        switch failure {
        case .missingKey, .invalidKey: CL("Your API key wasn’t accepted. Check it, or create a new one in the Anthropic Console.")
        case .rateLimited: CL("Your Anthropic account has reached its limit or is out of credit. Wait a moment, or check billing in the Anthropic Console.")
        case .overloaded: CL("Claude is busy right now. Try again in a moment.")
        case .offline: CL("Couldn’t reach Claude. Check your connection and try again.")
        case .declined: CL("The companion couldn’t answer that. Try saying it another way.")
        case .tooManySteps, .unreadableResponse: CL("Something went wrong with the reply. Try again.")
        case let .server(status, detail): CL("Claude returned an error (\(status)): \(detail ?? "–")")
        }
    }
}
