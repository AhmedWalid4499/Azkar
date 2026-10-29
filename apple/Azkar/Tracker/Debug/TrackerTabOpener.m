// Debug builds only: with the launch argument `-AzkarTrackerTab`, selects the Tracker tab once
// the window is up, so the tracker can be checked in a simulator nobody is tapping. Nothing
// happens without the argument, and nothing of this is in a release build.
#if DEBUG
#import <UIKit/UIKit.h>

@interface AzkarTrackerTabOpener : NSObject
@end

@implementation AzkarTrackerTabOpener

+ (void)load {
    if (![NSProcessInfo.processInfo.arguments containsObject:@"-AzkarTrackerTab"]) return;
    [self trySelecting:20];
}

/// Until the Tracker tab is selected and stays so: the tab bar comes up a moment after launch.
+ (void)trySelecting:(int)attempts {
    if (attempts <= 0) return;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.7 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (![self selectTrackerTab]) [self trySelecting:attempts - 1];
    });
}

/// Whether the Tracker tab is the selected one.
+ (BOOL)selectTrackerTab {
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (![scene isKindOfClass:UIWindowScene.class]) continue;
        for (UIWindow *window in ((UIWindowScene *)scene).windows) {
            UITabBarController *controller = [self tabBarControllerIn:window.rootViewController];
            // The fourth of the five tabs (RootView): Today, Azkar, Qibla, Tracker, Settings.
            if (controller != nil && controller.tabs.count > 3) {
                // As a tap does: ask the delegate (SwiftUI, which keeps the selection), select, then tell it.
                UITab *tracker = controller.tabs[3];
                UITab *previous = controller.selectedTab;
                if (previous == tracker) return YES;
                id<UITabBarControllerDelegate> delegate = controller.delegate;
                if ([delegate respondsToSelector:@selector(tabBarController:shouldSelectTab:)] &&
                    ![delegate tabBarController:controller shouldSelectTab:tracker]) {
                    return NO;
                }
                controller.selectedTab = tracker;
                if ([delegate respondsToSelector:@selector(tabBarController:didSelectTab:previousTab:)]) {
                    [delegate tabBarController:controller didSelectTab:tracker previousTab:previous];
                }
                // Checked again on the next attempt, in case the selection did not hold.
                return NO;
            }
        }
    }
    return NO;
}

+ (UITabBarController *)tabBarControllerIn:(UIViewController *)controller {
    if (controller == nil) return nil;
    if ([controller isKindOfClass:UITabBarController.class]) return (UITabBarController *)controller;
    for (UIViewController *child in controller.childViewControllers) {
        UITabBarController *found = [self tabBarControllerIn:child];
        if (found != nil) return found;
    }
    return [self tabBarControllerIn:controller.presentedViewController];
}

@end
#endif
