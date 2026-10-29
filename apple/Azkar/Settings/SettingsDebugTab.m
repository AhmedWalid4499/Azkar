// DEBUG builds only: opens a tab from a launch argument, for screenshots and checks in the
// simulator without tapping (`-AzkarDebugTab 3` opens the third tab, Qibla; 5 is Settings).
#if DEBUG
#import <UIKit/UIKit.h>

@interface AzkarSettingsDebugTab : NSObject
@end

@implementation AzkarSettingsDebugTab

+ (void)load {
    NSInteger tab = [[NSUserDefaults standardUserDefaults] integerForKey:@"AzkarDebugTab"];
    if (tab <= 0) return;
    __block id observer = [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationDidBecomeActiveNotification
                    object:nil
                     queue:NSOperationQueue.mainQueue
                usingBlock:^(NSNotification *note) {
                    [[NSNotificationCenter defaultCenter] removeObserver:observer];
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.4 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                        [self selectTab:tab - 1 attempts:20];
                    });
                }];
}

+ (void)selectTab:(NSInteger)index attempts:(NSInteger)attempts {
    if ([self selectTab:index] || attempts <= 1) return;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.25 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self selectTab:index attempts:attempts - 1];
    });
}

/// Whether the tab could be selected yet.
+ (BOOL)selectTab:(NSInteger)index {
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (![scene isKindOfClass:UIWindowScene.class]) continue;
        for (UIWindow *window in ((UIWindowScene *)scene).windows) {
            UITabBarController *tabs = [self tabsIn:window.rootViewController];
            if (tabs && index < (NSInteger)tabs.tabs.count) {
                UITab *previous = tabs.selectedTab;
                UITab *next = tabs.tabs[index];
                tabs.selectedTab = next;
                // SwiftUI follows the selection through the delegate, as for a tap.
                id<UITabBarControllerDelegate> delegate = tabs.delegate;
                if ([delegate respondsToSelector:@selector(tabBarController:didSelectTab:previousTab:)]) {
                    [delegate tabBarController:tabs didSelectTab:next previousTab:previous];
                }
                return YES;
            }
        }
    }
    return NO;
}

+ (UITabBarController *)tabsIn:(UIViewController *)controller {
    if (!controller) return nil;
    if ([controller isKindOfClass:UITabBarController.class]) return (UITabBarController *)controller;
    for (UIViewController *child in controller.childViewControllers) {
        UITabBarController *found = [self tabsIn:child];
        if (found) return found;
    }
    return [self tabsIn:controller.presentedViewController];
}

@end
#endif
