import AzkarKit
import SwiftUI

/// Shown once, the first time the app opens: the user's name, which the greeting and the reminders
/// use, then permission for the reminders and the adhan alarm, asked for as soon as that page appears.
struct WelcomeView: View {
    @Environment(AppEnvironment.self) private var app
    let onDone: () -> Void
    @State private var page = WelcomeView.firstPage
    @State private var name = ""
    @FocusState private var editing: Bool

    private enum Page {
        case name, permissions
    }

    var body: some View {
        VStack(spacing: 0) {
            switch page {
            case .name: namePage.transition(.asymmetric(insertion: .identity, removal: .move(edge: .leading).combined(with: .opacity)))
            case .permissions: WelcomePermissionsPage(onDone: onDone).transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .interactiveDismissDisabled()
    }

    private var namePage: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 24)
            Image(systemName: "sun.horizon.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
                .accessibilityHidden(true)
            Text("As-salamu alaykum", tableName: "App")
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)
            Text("Welcome to Azkar. What should we call you?", tableName: "App")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            TextField(text: $name) {
                Text("Your name", tableName: "App")
            }
            .font(.title3)
            .multilineTextAlignment(.center)
            .textContentType(.givenName)
            .submitLabel(.continue)
            .focused($editing)
            .onSubmit(next)
            .padding(.vertical, 14)
            .padding(.horizontal, 18)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
            Text("Used to greet you and in your reminders. It stays on this iPhone.", tableName: "App")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer(minLength: 24)
            Button(action: next) {
                Text("Continue", tableName: "App").frame(maxWidth: .infinity)
            }
            .prominentButtonStyle()
            .controlSize(.large)
            Button(action: next) {
                Text("Skip", tableName: "App")
            }
            .buttonStyle(.borderless)
            .opacity(name.trimmingCharacters(in: .whitespaces).isEmpty ? 1 : 0)
        }
        .onAppear { editing = true }
    }

    /// DEBUG builds open the permissions page with `-AzkarWelcome permissions`, for screenshots.
    private static var firstPage: Page {
        #if DEBUG
        UserDefaults.standard.string(forKey: "AzkarWelcome") == "permissions" ? .permissions : .name
        #else
        .name
        #endif
    }

    private func next() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { app.settings.update { $0.app.name = trimmed } }
        editing = false
        withAnimation(.smooth) { page = .permissions }
    }
}

/// Asks for notifications, then for alarms, as soon as it appears, and shows how each went.
private struct WelcomePermissionsPage: View {
    let onDone: () -> Void
    @State private var asking = true

    private var permissions: SystemPermissions { SystemServices.shared.permissions }

    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 24)
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 60))
                .foregroundStyle(.tint)
                .accessibilityHidden(true)
            Group {
                if SystemPermissions.alarmsAvailable {
                    Text("Reminders and the adhan", tableName: "App")
                } else {
                    Text("Reminders", tableName: "App")
                }
            }
            .font(.largeTitle.bold())
            .multilineTextAlignment(.center)
            Group {
                if SystemPermissions.alarmsAvailable {
                    Text("Azkar reminds you when each prayer’s time comes, asks whether you prayed before it ends, and can sound the adhan as an alarm, even in silent mode.", tableName: "App")
                } else {
                    Text("Azkar reminds you when each prayer’s time comes and asks whether you prayed before it ends.", tableName: "App")
                }
            }
            .font(.body)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            VStack(spacing: 0) {
                row(Text("Notifications", tableName: "App"), symbol: "bell.fill", state: permissions.notifications)
                if SystemPermissions.alarmsAvailable {
                    Divider().padding(.leading, 52)
                    row(Text("Alarms", tableName: "App"), symbol: "alarm.fill", state: permissions.alarms)
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
            Text("You can change these at any time in Settings › Reminders.", tableName: "App")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer(minLength: 24)
            Button(action: onDone) {
                Text("Start", tableName: "App").frame(maxWidth: .infinity)
            }
            .prominentButtonStyle()
            .controlSize(.large)
            .disabled(asking)
        }
        .task {
            // One system prompt after the other; nothing is asked twice.
            // Allowing notifications turns on the one at each prayer time.
            let notifications = await SystemServices.shared.requestNotifications()
            _ = await permissions.requestAlarms()
            if notifications { await SystemServices.shared.refresh(reason: "welcome") }
            asking = false
        }
    }

    private func row(_ name: Text, symbol: String, state: SystemPermissions.State) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .foregroundStyle(.tint)
                .frame(width: 24)
            name
            Spacer(minLength: 8)
            Group {
                switch state {
                case .allowed:
                    Label { Text("Allowed", tableName: "App") } icon: { Image(systemName: "checkmark.circle.fill") }
                        .foregroundStyle(.green)
                case .denied:
                    Label { Text("Not allowed", tableName: "App") } icon: { Image(systemName: "xmark.circle.fill") }
                        .foregroundStyle(.secondary)
                case .notDetermined:
                    ProgressView()
                }
            }
            .font(.subheadline)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }
}
