import UIKit

/// Sets up, before the app finishes launching, what iOS requires that early: the notification
/// delegate (so a "Prayed ✓" that wakes the app in the background is answered) and the background
/// refresh task. Attach it in `AzkarApp`:
///
/// ```swift
/// @UIApplicationDelegateAdaptor(SystemAppDelegate.self) private var systemDelegate
/// ```
final class SystemAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        SystemServices.shared.launch()
        BackgroundRefresh.register()
        return true
    }

    /// Set while a screen that only works upright is open (the mushaf, on iPhone).
    static var portraitOnly = false

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        Self.portraitOnly ? .portrait : .all
    }
}
