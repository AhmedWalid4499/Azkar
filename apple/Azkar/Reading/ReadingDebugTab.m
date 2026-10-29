// DEBUG only: `-ReadingSelectTab <index>` selects that tab shortly after launch, so screenshots of
// the Azkar tab (index 1) can be taken without touching the screen. Compiled out of release builds.
#if DEBUG
#import <UIKit/UIKit.h>

static UITabBarController *ReadingDebugFindTabBarController(UIViewController *controller) {
    if ([controller isKindOfClass:[UITabBarController class]]) return (UITabBarController *)controller;
    for (UIViewController *child in controller.childViewControllers) {
        UITabBarController *found = ReadingDebugFindTabBarController(child);
        if (found != nil) return found;
    }
    return nil;
}

static void ReadingDebugSelect(NSInteger index, NSInteger attempts) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.8 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if (![scene isKindOfClass:[UIWindowScene class]]) continue;
            for (UIWindow *window in ((UIWindowScene *)scene).windows) {
                UITabBarController *tabs = ReadingDebugFindTabBarController(window.rootViewController);
                if (tabs != nil && index < (NSInteger)tabs.tabs.count) {
                    tabs.selectedTab = tabs.tabs[(NSUInteger)index];
                    NSLog(@"ReadingDebug: selected tab %ld of %@", (long)index, tabs);
                    return;
                }
            }
        }
        if (attempts > 0) ReadingDebugSelect(index, attempts - 1);
        else NSLog(@"ReadingDebug: no tab bar controller; root: %@", UIApplication.sharedApplication.connectedScenes);
    });
}

__attribute__((constructor)) static void ReadingDebugSelectTabAtLaunch(void) {
    NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
    if ([defaults objectForKey:@"ReadingSelectTab"] == nil) return;
    ReadingDebugSelect([defaults integerForKey:@"ReadingSelectTab"], 30);
}
#endif
