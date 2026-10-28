import Capacitor
import Foundation
import WidgetKit

/// The app's side of the home-screen and lock-screen widgets (src/native/widgetBridge.ts).
/// Compiled into the app itself and registered by `AppBridgeViewController`.
@objc(AzkarWidgetPlugin)
public class AzkarWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AzkarWidgetPlugin"
    public let jsName = "AzkarWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePendingActions", returnType: CAPPluginReturnPromise)
    ]

    /// Saves the snapshot in the App Group and has every widget rebuild its timeline from it.
    @objc func publish(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8) else {
            call.reject("Expected the snapshot as JSON text in `json`.")
            return
        }
        let snapshot: WidgetSnapshot
        do {
            snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
        } catch {
            call.reject("The snapshot could not be read.", nil, error)
            return
        }
        guard let store = WidgetStore.shared() else {
            call.reject("The App Group is not available to this build.")
            return
        }
        do {
            try store.publish(snapshot)
        } catch {
            call.reject("The snapshot could not be saved.", nil, error)
            return
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Returns the prayers marked on a widget since the last call, and forgets them.
    @objc func takePendingActions(_ call: CAPPluginCall) {
        guard let store = WidgetStore.shared() else {
            call.resolve(["actions": []])
            return
        }
        do {
            let actions = try store.takeActions()
            call.resolve(["actions": actions.map(\.dictionary)])
        } catch {
            call.reject("The widget's taps could not be read.", nil, error)
        }
    }
}
