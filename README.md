# Azkar — أذكار

Morning and evening azkar, prayer times for where you are, and a daily prayer log. It is bilingual (English and Arabic, with a right-to-left layout) and keeps working without a connection. It comes two ways from one codebase: a website that installs to the home screen, and an iOS and Android app (see [Mobile app](#mobile-app)). There are no accounts, no ads and no tracking: everything you enter stays on your device.

**Live app:** <https://ahmedwalid4499.github.io/Azkar/> (available once GitHub Pages is enabled for the repository, see [Deploying](#deploying-to-github-pages)).

Status: early version (0.1.0).

## Features

**Azkar reader**

- Morning and evening sessions, one dhikr at a time: fully vocalised Arabic, transliteration, English meaning, the narration it comes from and, where there is one, its virtue.
- A large tap counter for repeated azkar, with undo, "mark all done", optional haptic feedback and auto-advance.
- Progress is kept per day, so a session can be left and resumed. An evening session read after midnight still counts for the evening it belongs to.
- Adjustable Arabic text size, optional keep-screen-awake, swipe and keyboard navigation.

**Prayer times**

- The five prayers and sunrise for your location, calculated on the device. Works offline once a location is saved.
- A countdown to the next prayer and the Hijri date.
- Twelve calculation methods and the Asr school, both chosen automatically from your country and changeable in Settings; high-latitude rules; per-prayer adjustments of up to 30 minutes to match your mosque's timetable.
- Location from the device's GPS or by searching for a city.
- Optional reminders at each prayer time while the app is open.

**Prayer log**

- Mark each prayer as on time, in congregation, late (made up), missed or excused. One tap from the Today page logs "on time".
- Between midnight and Fajr the Today page also offers last night's Isha while it is still unlogged, so ticking it off late counts for the day it belongs to.
- A month calendar that also names the Hijri months it spans, current and best streaks, 7-day and 30-day completion, and a monthly breakdown per prayer.

**Throughout**

- English and Arabic, light and dark themes, 12- or 24-hour clock, Arabic-Indic or Western digits.
- Installable (Android, iOS, desktop) and fully usable offline.
- Also an iOS and Android app, with reminders that arrive while the app is closed, the phone's own haptics, and backups through the share sheet.
- Export your data to a file, import it on another device, or erase it, from Settings.
- Can be open in several tabs or windows at once, or installed next to a browser tab: a change made in one reaches the others, and erasing or importing in one reloads them.

## How prayer times are calculated

Times are computed on your device by the open-source [adhan](https://github.com/batoulapps/adhan-js) library from four inputs: your coordinates, the date, a calculation method (the sun's angle below the horizon at Fajr and Isha) and the school used for Asr. No timetable is downloaded.

- **Method.** "Automatic" picks the method closest to what the religious authority of your country publishes: Egyptian General Authority of Survey in Egypt, Umm al-Qura in Saudi Arabia, the Dubai, Kuwait and Qatar methods in those countries, Diyanet in Turkey, the Institute of Geophysics in Iran, the University of Islamic Sciences, Karachi in Pakistan, India, Bangladesh, Afghanistan and Malaysia, the Singapore (MUIS) method in Singapore, Indonesia and Brunei, ISNA in the United States and Canada, the Moonsighting Committee in the United Kingdom, and the Muslim World League everywhere else. Any of the twelve can be chosen by hand.
- **Asr.** "Automatic" uses the Hanafi time in Pakistan, India, Bangladesh and Afghanistan, where most mosques follow it, and "Standard" (Shafi'i, Maliki and Hanbali) everywhere else; either can be chosen by hand. A setting you have already saved is never changed for you.
- **High latitudes.** Around midsummer at high latitudes, when twilight lasts most or all of the night, Fajr and Isha are capped by a high-latitude rule. "Automatic" uses the twilight-angle rule, which leaves ordinary days untouched; middle of the night and one-seventh of the night can be chosen instead. Above 65° an optional setting borrows the times of the nearest latitude where the sun still rises and sets.
- **Ramadan.** With the Umm al-Qura method, Isha is held 120 minutes after Maghrib during Ramadan instead of 90, as the Umm al-Qura calendar does.
- **Adjustments.** Each time can be moved by up to 30 minutes either way.

The engine is tested against 26 timetables published by others (the Aladhan API, Diyanet, JAKIM, the Moonsighting Committee and a UAE newspaper), covering cities from Makkah and Cairo to London, Jakarta, New York, Sydney and Kiritimati, with a tolerance of two minutes. The fixtures are in `src/features/prayer-times/engine/reference.fixtures.ts`.

Mosques follow different methods, and some add a few minutes of precaution. If the times here differ from your mosque's timetable, pick the method it uses or fine-tune the times in Settings.

The Hijri date comes from the browser's Umm al-Qura calendar, with a setting to shift it by up to two days either way.

## Where the azkar come from

The selection, order and repeat counts follow the chapter "Azkar of the morning and the evening" of *Hisn al-Muslim* (Fortress of the Muslim) by Sa'id ibn Ali ibn Wahf al-Qahtani. The dataset holds 30 azkar: 23 in the morning session and 20 in the evening one, with separate items where the morning and evening wordings differ. Istighfar ("Astaghfirullaha wa atubu ilayh", one hundred times a day) is listed in the morning session only, so that doing both sessions does not ask for it twice.

No Arabic was typed by hand. The text is copied by a script from pinned copies of these sources, which the app also lists under Settings:

| Source | Used for | Licence |
| --- | --- | --- |
| *Hisn al-Muslim*, digital text with footnotes, read from [abdorizak/Hisnul-Muslim](https://github.com/abdorizak/Hisnul-Muslim) | Selection and order of the azkar, repeat counts, and the Arabic references, virtues and notes (short extracts of the chapter's footnotes) | The book belongs to its author and publisher (Matba'at Safir, Riyadh); no licence is stated for the text. The repository it was read from is MIT-licensed, which covers the repository, not the book |
| [asellam/HisnElMuslim](https://github.com/asellam/HisnElMuslim) | Vocalised Arabic text of every supplication, including the separate evening wordings | MIT |
| [Seen-Arabic/Morning-And-Evening-Adhkar-DB](https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB) | Three words whose vowel marks complete the text above, part of one Arabic reference, and cross-checking | MIT |
| [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api), Sahih Muslim in Arabic | The standard the evening supplication of Sahih Muslim no. 2723 is checked against word by word; checking hadith numbers | The Unlicense (public domain) |
| [Tanzil Quran Text](https://tanzil.net/) (Simple Plain, version 1.1), retrieved through the Al Quran Cloud API | Every Qur'anic passage: Ayat al-Kursi (2:255), surahs 112 to 114 and the basmala | Creative Commons Attribution 3.0. Copyright © Tanzil Project; the text is reproduced verbatim and may not be changed |

The exact files and commits are recorded in `src/features/azkar/data/azkar.json` and `scripts/azkar/sources.mjs`. The three complete compilations of the book are not redistributed from this repository: they are downloaded on demand and checked against pinned sha256 sums. The English translations of the meaning and the transliterations were written for this project and live in `scripts/azkar/mapping.mjs`.

To rebuild or check the dataset:

```sh
node scripts/azkar/fetch.mjs    # download the pinned source files (checked against their sha256)
node scripts/azkar/build.mjs    # assemble src/features/azkar/data/azkar.json
node scripts/azkar/verify.mjs   # cross-check the Arabic and the hadith numbers against other witnesses
```

The app and its tests need none of those downloads. The unit tests require every Qur'anic passage to equal its ayat exactly, check each ayah against a checksum taken from the Tanzil download, keep a fingerprint of each recited text so that an accidental edit of a single mark is noticed, and check the vocalisation is complete.

Some of the virtues shown rest on narrations whose grading scholars differ on; each dhikr's reference names who graded its chain.

If you find a mistake in a text, a count, a reference or a translation, please open an issue.

## Privacy

- **Everything is stored on your device.** Settings, the saved location, reading progress and the prayer log live in the browser's local storage, under keys starting with `azkar:`. There is no server, no account, no analytics and no cookie. Clearing the browser's site data, or "Erase all data" in Settings, removes it all.
- **In the iOS and Android apps** the same data lives in the app's own web storage, with a copy in the app's native storage (UserDefaults on iOS, SharedPreferences on Android) that puts it back if the system ever clears the web storage. Both are removed when you delete the app. The phone's own backup (iCloud Backup, or Android's backup to your Google account) includes them as it includes any app's data, when you have it switched on. The apps load no code from the internet and contact the same two services as the website, in the same two cases.
- **Backups are files you keep.** Export writes a JSON file to your device (in the apps, through the share sheet, to the place you choose); nothing is uploaded. Importing replaces what is stored only if the whole backup can be saved; if it cannot (the browser's storage is full, say), nothing is changed.
- **Fonts and icons are bundled** with the app, so nothing is fetched from a font or CDN service.
- **The app contacts a third party in exactly two cases, both started by you:**
  - *Use my location.* The browser asks for permission and gives the app your position. It is saved on the device rounded to three decimals (about 100 m). To show a place name, the coordinates rounded to **two decimals (about 1 km)** and the interface language are sent once to [BigDataCloud](https://www.bigdatacloud.com/)'s reverse-geocoding service.
  - *Search for a city.* What you type in the search box (from the second character on) and the interface language are sent to the [Open-Meteo](https://open-meteo.com/) geocoding service.

  Those answers are never cached by the service worker, and both lookups simply fail when you are offline. If the place name cannot be fetched, the location is still saved and prayer times still work.
- **The host.** The app's own files are served by GitHub Pages, which, like any web host, sees the IP address of a device that downloads them. After the first visit the files come from the device's cache; the app only asks the host whether a new version exists, when it is opened and at most once an hour while it stays open.

## Getting started

Requirements: [Node.js](https://nodejs.org/) 24 (24.15 or later; the version is pinned in `.nvmrc`) and npm.

```sh
git clone https://github.com/AhmedWalid4499/Azkar.git
cd Azkar
npm ci
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload. No service worker is registered in development. |
| `npm run build` | Type-check, then build the production site and its service worker into `dist/`. |
| `npm run preview` | Serve `dist/` locally, service worker included, to try installing and offline use. |
| `npm test` | Run the unit and component tests once (Vitest, jsdom). `npm run test:watch` keeps watching. |
| `npm run lint` | Lint with oxlint. |
| `npm run typecheck` | Type-check with TypeScript in strict mode. |
| `npm run icons` | Regenerate the PNG and ICO icons in `public/` from the SVG sources in `scripts/pwa/`. |
| `npm run build:app` | Build the website as `npm run build` does, then copy it into the iOS and Android projects (`cap sync`). |
| `npm run ios` | Open the iOS project in Xcode. |
| `npm run android` | Open the Android project in Android Studio. |
| `npm run assets` | Regenerate the app icons and the light and dark launch screens in `ios/` and `android/` from the artwork in `scripts/pwa/`. |

Built with Vite, React, TypeScript, zustand and React Router (hash routes), with plain CSS design tokens and CSS modules. The iOS and Android apps wrap the same build with Capacitor.

## Project structure

```text
index.html                 HTML shell: meta tags, icons
vite.config.ts             Vite, the web manifest and the service worker (vite-plugin-pwa), Vitest
capacitor.config.ts        The iOS and Android apps: app id, name, launch screen, notification icon
ios/                       Xcode project of the iOS app (generated by Capacitor, then localised)
android/                   Android Studio project of the Android app (generated by Capacitor)
resources/                 Icon and launch-screen sources for the apps, rendered from scripts/pwa/
public/                    Icons and the service worker's notification-click handler
scripts/
  azkar/                   Fetches, builds and verifies the azkar dataset
  pwa/                     SVG icon sources and the icon generator
src/
  main.tsx                 Entry point: fonts, global styles, then (once stored data is in place) the app
  app/                     Starting the app, routes, the app shell (tab bar), the error screen, keeping open tabs in step,
                           Android's back button and the status bar
  native/                  The only door to native features (storage copy, files, haptics, keep-awake,
                           location, notifications, launch screen, status bar); each also works in a browser
  features/
    today/                 Home page: next prayer, today's times, azkar cards
    azkar/                 Session picker, reader, progress; data/azkar.json is the dataset
    prayer-times/          Calculation engine (engine/), location (location/), settings, reminders
    prayer-log/            Log store, statistics, calendar and log page
    settings/              Settings page, backup export and import
  pwa/                     Service-worker registration and the "new version" banner
  shared/                  i18n, design tokens and global styles, UI primitives, date, storage and tab-sync helpers
.github/workflows/         Build, test and deploy to GitHub Pages
```

Each feature keeps its own strings (`strings.ts`, English and Arabic), styles and tests next to its code.

## Offline use and updates

The production build registers a service worker that stores the whole app on the device at the first visit: the page, scripts, styles, icons and the Arabic fonts, about 0.9 MB in total. From then on the app opens without a connection.

When a new version has been deployed, the app downloads it in the background and shows a small "A new version is available" banner with a Reload button. It never reloads by itself, so a recitation is not interrupted; the banner waits while the reader is open. If you ignore it, the new version is used the next time the app is fully closed and reopened.

To install: in Chrome or Edge use "Install app" (or "Add to Home screen" on Android); in Safari on iPhone and iPad use Share, then "Add to Home Screen".

The iOS and Android apps have neither: they carry their own copy of the app, and a new version arrives by installing a new build.

## Mobile app

The same code also runs as an iOS and an Android app, built with [Capacitor](https://capacitorjs.com/). The app contains its own copy of the website, so it works fully offline from the first launch, and it never loads code from the internet. The website keeps working as before.

**What the app adds over the website**

| | Website | iOS and Android app |
| --- | --- | --- |
| Prayer-time reminders | Only while the website is open | Scheduled with the system, so they arrive while the app is closed; renewed each time the app is opened |
| Haptic feedback | Vibration, in Android browsers only | The phone's own haptics |
| Keeping the screen on in the reader (when chosen in Settings) | Where the browser supports it | On every phone, through the system |
| Stored data | Browser storage | The app's web storage, plus a native copy that puts it back if the system clears it |
| Backups | Downloaded as a file | Saved or sent through the share sheet (Files, Drive, mail and so on) |
| Back button | The browser's | Android: closes an open sheet, goes back a screen, and leaves the app from Today |
| Links to other sites | New tab | The system browser; the licence notices open inside the app |
| Updates | The "new version" banner | A new build; no banner and no service worker |

Everything else is shared: the screens, the stored data and its format, backups and the tests. The native features are reached only through `src/native/`, and each also works in a browser (or does nothing there).

**After changing the web code**, run `npm run build:app` before running from Xcode or Android Studio. The native projects run a copy of `dist/` (in `ios/App/App/public` and `android/app/src/main/assets/public`, not committed), and only this command refreshes it.

### iOS: run on the Simulator

Needs a Mac with [Xcode](https://apps.apple.com/app/xcode/id497799835) (free). The app supports iOS 16.4 and later: the web code is built for Vite's default browser target (Safari and iOS 16.4) and uses JavaScript that older iOS web views lack, so the Xcode project does not offer it to older versions.

```sh
npm ci
npm run build:app
npm run ios          # opens ios/App/App.xcodeproj in Xcode
```

In Xcode, pick an iPhone simulator in the toolbar and press Run (⌘R). The first build downloads Capacitor's Swift packages and takes a few minutes. `npx cap run ios` does the same from the terminal and asks which simulator to use.

### iOS: install on your own iPhone with a free Apple ID

1. In Xcode open **Settings → Accounts** and add your Apple ID.
2. Select the **App** target, then **Signing & Capabilities**, and choose your **Personal Team**. If Xcode reports that the bundle identifier is not available to your team, change it there to one of your own, such as `io.github.yourname.azkar`, and then keep it: the app's data on the phone belongs to it.
3. Connect the iPhone with a cable, unlock it and trust the computer. On iOS 16 and later, turn on **Settings → Privacy & Security → Developer Mode** (the phone restarts).
4. Choose the iPhone as the run destination and press Run. The first time, on the iPhone, open **Settings → General → VPN & Device Management** and trust your developer certificate.

With a free account the installed app stops opening after **7 days**; run it again from Xcode to renew it for another 7 (your data stays, as long as you do not delete the app). A free account can also keep only a few apps installed this way at a time. To install for longer, or to share the app through **TestFlight** or the **App Store**, you need the paid [Apple Developer Program](https://developer.apple.com/programs/) (99 USD a year).

App Store Connect turns down a build that uses certain system APIs without saying why. `ios/App/App/PrivacyInfo.xcprivacy` gives the reasons for the two the app's plugins use (UserDefaults for the native copy of the data, and file dates); a new plugin may need another entry there.

### Android: build and install

1. Install [Android Studio](https://developer.android.com/studio). It brings the Android SDK and the Java 21 runtime the build needs; on first start let it install the SDK it offers (the app targets Android 16, API 36, and runs on Android 7.0 and later).
2. Run `npm ci`, then `npm run build:app`, then `npm run android` to open the `android/` folder in Android Studio, and wait for the Gradle sync to finish.
3. Connect a phone with USB debugging on (**Settings → About phone**, tap **Build number** seven times, then **Developer options → USB debugging**), or create an emulator in **Device Manager**, and press Run.

To build an installable APK from the terminal instead:

```sh
cd android
./gradlew assembleDebug    # writes app/build/outputs/apk/debug/app-debug.apk
```

This needs `JAVA_HOME` pointing at Java 21 (on a Mac, Android Studio's own: `/Applications/Android Studio.app/Contents/jbr/Contents/Home`) and the SDK location, which Android Studio writes to `android/local.properties` the first time it opens the project (or set `ANDROID_HOME`, usually `~/Library/Android/sdk`). Copy the APK to a phone and open it to install, allowing installs from that source when asked. For Google Play, build a signed release bundle (**Build → Generate Signed App Bundle**) with a key of your own, and keep that key out of the repository (`.gitignore` already leaves out `*.jks` and `*.keystore`).

On Android 12 and later, reminders arrive at the exact minute only while **Alarms & reminders** is allowed for Azkar (**Settings → Apps → Azkar**); without it Android may deliver them a few minutes late.

### Icons and launch screen

The app icons and the light and dark launch screens are generated from the artwork in `scripts/pwa/` by `npm run assets`, which renders the sources in `resources/` and writes every size into `ios/` and `android/`. Commit what it writes.

### Things not to change

- **The app id** `io.github.ahmedwalid4499.azkar` (in `capacitor.config.ts`, the Xcode project and `android/app/build.gradle`), once the app is in people's hands. The stores, and the phone, know the app by it; a new id is a new app with no data.
- **`server.hostname`, `iosScheme` and `androidScheme`** in `capacitor.config.ts`, left at their defaults. The stored data belongs to the web view's origin, and a new origin starts empty.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs on every push to `main` (and can be started by hand from the Actions tab). It installs dependencies, lints, type-checks, tests and builds, then publishes `dist/` to GitHub Pages. It builds the website only; the iOS and Android apps are built on your own machine (see [Mobile app](#mobile-app)).

One-time setup: in the repository on GitHub open **Settings → Pages** and set **Source** to **GitHub Actions**. Until that is done the build job still passes, and only the deploy job fails.

The site is built with relative URLs and hash-based routes, so the same build works under `https://<user>.github.io/Azkar/`, at a domain root, or from any other static host: copy the contents of `dist/` there. It must be served over HTTPS for installation, offline use and location to work.

## Known limitations

- **On the website, reminders only work while it is open.** A web app cannot schedule a notification for a time when it is closed (the iOS and Android apps can, and do). Reminders arrive while Azkar is open or in a background tab, can be up to about a minute late in a throttled background tab, and are skipped when they are more than five minutes overdue (for example after the device was asleep). On iPhone and iPad notifications are only available after the app has been added to the Home Screen.
- **The Hijri date may differ from your local moon sighting.** It is calculated (Umm al-Qura calendar), not observed. Settings has an offset of up to two days either way.
- **Prayer times are a calculation.** They can differ by a few minutes from a mosque's timetable; choose its method or fine-tune the times. Near the poles, on days when the sun does not rise or set, or stays too close to the horizon for Asr, some times cannot be calculated; the polar setting then borrows the whole day from the nearest latitude where every time exists.
- **Data stays on one device.** There is no sync; use export and import to move it. Browsers may clear the storage of sites that are not installed and not visited for a long time, so export a backup now and then. The iOS and Android apps keep a native copy that survives that.
- **The apps are not in the App Store or Google Play yet.** Until they are, they are installed from Xcode or Android Studio (see [Mobile app](#mobile-app)), and a free Apple ID installs for 7 days at a time.
- **The licence notices in the app list what is bundled into the web code** (Capacitor's JavaScript included). The native libraries compiled into the iOS and Android apps, Capacitor's native runtime and plugins (MIT) and, on Android, the AndroidX libraries (Apache 2.0), are not listed there yet, and must be before the apps are distributed.
- **A place name keeps the language it was fetched in** until the location is updated. Coordinates shown in place of a name follow the interface language.
- **Only the morning and evening azkar are included** at present. The translations are in English only.
- **Location lookups depend on two free third-party services:** Open-Meteo (free for non-commercial use) and BigDataCloud (under its fair-use policy). If either changes its terms or goes away, city search or place names stop working; prayer times for a saved location do not.

## Credits and licences

The app is built on the work of others:

| Piece | Used for | Licence |
| --- | --- | --- |
| [adhan](https://github.com/batoulapps/adhan-js) by Batoul Apps | Prayer-time calculation | MIT |
| [Amiri](https://github.com/aliftype/amiri) by the Amiri Project Authors, packaged by [Fontsource](https://fontsource.org/) | Recitation typeface | SIL Open Font License 1.1 |
| [IBM Plex Sans Arabic](https://github.com/IBM/plex) by IBM, packaged by Fontsource | Arabic interface typeface | SIL Open Font License 1.1 |
| [Lucide](https://lucide.dev/) | Icons | ISC |
| [React](https://react.dev/), [React Router](https://reactrouter.com/), [zustand](https://github.com/pmndrs/zustand) | Application framework | MIT |
| [Workbox](https://developer.chrome.com/docs/workbox) and [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | Service worker and offline support | MIT |
| [Capacitor](https://capacitorjs.com/) and its App, Filesystem, Geolocation, Haptics, Local Notifications, Preferences, Share, Splash Screen and Status Bar plugins, by Ionic; [keep-awake](https://github.com/capacitor-community/keep-awake) by the Capacitor Community | The iOS and Android apps | MIT |
| [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), with data from [GeoNames](https://www.geonames.org/) | City search | CC BY 4.0, free for non-commercial use |
| [BigDataCloud](https://www.bigdatacloud.com/) reverse geocoding | Place name for a GPS position | Free client-side API under its fair-use policy |
| The azkar and Qur'an text sources | See [Where the azkar come from](#where-the-azkar-come-from) | As listed there |

The build collects the copyright and licence notices of every package bundled into the app (adhan, the two typefaces, Lucide, React, React Router, zustand, Workbox's window helper and Capacitor's JavaScript) into `licenses.txt`, which is published next to the app and stored for offline use with it.

## Licence

No licence has been chosen for this project yet; that decision is the owner's. The third-party pieces listed above remain under their own licences.
