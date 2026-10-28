import Capacitor
import UIKit

/// Capacitor's view controller, plus the plugins compiled into the app itself: the npm
/// plugins are found through capacitor.config.json, these have to be registered here.
class AppBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AzkarWidgetPlugin())
    }
}
