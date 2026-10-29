import AlarmKit
import AzkarKit
import SwiftUI
import UIKit
import UserNotifications

/// The reminder choices of `ReminderSettings`. This screen only edits them: the system services
/// schedule what they describe and ask for permission when one is turned on. It shows whether
/// notifications and alarms are allowed, so a switch that cannot work says why.
struct SettingsRemindersView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @Environment(\.scenePhase) private var scenePhase
    @State private var notifications: UNAuthorizationStatus?
    @State private var alarms: AlarmManager.AuthorizationState?

    private var reminders: ReminderSettings { app.settings.settings.reminders }

    var body: some View {
        Form {
            permissionSection

            Section {
                Toggle(isOn: binding(\.prayers)) {
                    Text("Notify me at prayer times", tableName: SettingsText.table)
                    Text("A notification when each of the five prayers begins.", tableName: SettingsText.table)
                }
            }

            Section {
                Toggle(isOn: binding(\.unlogged)) {
                    Text("Remind me of prayers I haven’t logged", tableName: SettingsText.table)
                    Text(SettingsText.string("\(SettingsText.minutes(reminders.unloggedLeadMinutes, locale: locale)) before a prayer’s time ends, if it isn’t logged yet.", locale: locale))
                }
                if reminders.unlogged {
                    Picker(selection: binding(\.unloggedLeadMinutes)) {
                        ForEach(ReminderSettings.unloggedLeadChoices, id: \.self) { minutes in
                            Text(SettingsText.minutes(minutes, locale: locale)).tag(minutes)
                        }
                    } label: {
                        Text("How long before the time ends", tableName: SettingsText.table)
                    }
                    Picker(selection: binding(\.ishaDeadline)) {
                        Text("Middle of the night", tableName: SettingsText.table).tag(IshaDeadline.middle)
                        Text("Fajr", tableName: SettingsText.table).tag(IshaDeadline.fajr)
                    } label: {
                        Text("End of Isha’s time", tableName: SettingsText.table)
                    }
                }
            } footer: {
                if reminders.unlogged {
                    Text("The middle of the night, halfway from Maghrib to Fajr, ends Isha’s preferred time according to a hadith in Sahih Muslim.", tableName: SettingsText.table)
                }
            }

            Section {
                Toggle(isOn: binding(\.morningAzkar)) {
                    Text("Remind me of the morning azkar", tableName: SettingsText.table)
                }
                if reminders.morningAzkar {
                    Picker(selection: binding(\.morningAt)) {
                        Text("When Fajr begins", tableName: SettingsText.table).tag(MorningReminderTime.fajr)
                        Text("After sunrise", tableName: SettingsText.table).tag(MorningReminderTime.sunrise)
                    } label: {
                        Text("Morning reminder", tableName: SettingsText.table)
                    }
                }
                Toggle(isOn: binding(\.eveningAzkar)) {
                    Text("Remind me of the evening azkar", tableName: SettingsText.table)
                    Text("When Asr begins.", tableName: SettingsText.table)
                }
            } header: {
                Text("Azkar", tableName: SettingsText.table)
            }

            Section {
                ForEach(Prayer.allCases) { prayer in
                    Toggle(isOn: adhanBinding(prayer)) {
                        Text(SettingsText.prayer(prayer, locale: locale))
                    }
                }
            } header: {
                Text("Adhan alarm", tableName: SettingsText.table)
            } footer: {
                Text("Sounds the adhan as an alarm when the prayer’s time begins, even in silent mode or a Focus.", tableName: SettingsText.table)
            }
        }
        .navigationTitle(Text("Reminders", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: scenePhase) { await readPermissions() }
        .onChange(of: reminders) { Task { await readPermissions() } }
    }

    // MARK: Permissions

    @ViewBuilder private var permissionSection: some View {
        let needsNotifications = reminders.prayers || reminders.unlogged || reminders.morningAzkar || reminders.eveningAzkar
        Section {
            LabeledContent {
                Text(notificationsText)
            } label: {
                Label { Text("Notifications", tableName: SettingsText.table) } icon: { Image(systemName: "bell") }
            }
            LabeledContent {
                Text(alarmsText)
            } label: {
                Label { Text("Alarms", tableName: SettingsText.table) } icon: { Image(systemName: "alarm") }
            }
            if notifications == .denied || alarms == .denied, let url = URL(string: UIApplication.openSettingsURLString) {
                Link(destination: url) {
                    Text("Open Settings", tableName: SettingsText.table)
                }
            }
        } footer: {
            if notifications == .denied, needsNotifications {
                Text("Notifications are turned off for Azkar, so these reminders can’t arrive. Allow them in Settings › Apps › Azkar › Notifications.", tableName: SettingsText.table)
            } else if alarms == .denied, !reminders.adhan.isEmpty {
                Text("Alarms are turned off for Azkar, so the adhan can’t sound. Allow them in Settings › Apps › Azkar.", tableName: SettingsText.table)
            } else {
                Text("Azkar asks for permission the first time a reminder needs it. Reminders are set on this iPhone for the days ahead, so they arrive even when the app is closed.", tableName: SettingsText.table)
            }
        }
    }

    private var notificationsText: String {
        switch notifications {
        case .authorized, .provisional, .ephemeral: SettingsText.string("Allowed", locale: locale)
        case .denied: SettingsText.string("Off", locale: locale)
        case .notDetermined: SettingsText.string("Not asked yet", locale: locale)
        default: ""
        }
    }

    private var alarmsText: String {
        switch alarms {
        case .authorized: SettingsText.string("Allowed", locale: locale)
        case .denied: SettingsText.string("Off", locale: locale)
        case .notDetermined: SettingsText.string("Not asked yet", locale: locale)
        default: ""
        }
    }

    private func readPermissions() async {
        notifications = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        alarms = AlarmManager.shared.authorizationState
    }

    // MARK: Bindings

    private func binding<Value>(_ path: WritableKeyPath<ReminderSettings, Value>) -> Binding<Value> {
        Binding(
            get: { app.settings.settings.reminders[keyPath: path] },
            set: { value in app.settings.update { $0.reminders[keyPath: path] = value } }
        )
    }

    private func adhanBinding(_ prayer: Prayer) -> Binding<Bool> {
        Binding(
            get: { reminders.adhan.contains(prayer) },
            set: { on in
                app.settings.update {
                    if on { $0.reminders.adhan.insert(prayer) } else { $0.reminders.adhan.remove(prayer) }
                }
            }
        )
    }
}

#Preview {
    NavigationStack { SettingsRemindersView() }
        .environment(try! AppEnvironment())
}
