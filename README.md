# Azkar — أذكار

Morning and evening azkar, prayer times for where you are, and a daily prayer log, in one small web app. It is bilingual (English and Arabic, with a right-to-left layout), installs to the home screen like a native app, and keeps working without a connection. There are no accounts, no ads and no tracking: everything you enter stays on your device.

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
- Twelve calculation methods, chosen automatically from your country and changeable in Settings; Standard or Hanafi Asr; high-latitude rules; per-prayer adjustments of up to 30 minutes to match your mosque's timetable.
- Location from the device's GPS or by searching for a city.
- Optional reminders at each prayer time while the app is open.

**Prayer log**

- Mark each prayer as on time, in congregation, late (made up), missed or excused. One tap from the Today page logs "on time".
- A month calendar that also names the Hijri months it spans, current and best streaks, 7-day and 30-day completion, and a monthly breakdown per prayer.

**Throughout**

- English and Arabic, light and dark themes, 12- or 24-hour clock, Arabic-Indic or Western digits.
- Installable (Android, iOS, desktop) and fully usable offline.
- Export your data to a file, import it on another device, or erase it, from Settings.

## How prayer times are calculated

Times are computed on your device by the open-source [adhan](https://github.com/batoulapps/adhan-js) library from four inputs: your coordinates, the date, a calculation method (the sun's angle below the horizon at Fajr and Isha) and the school used for Asr. No timetable is downloaded.

- **Method.** "Automatic" picks the method closest to what the religious authority of your country publishes: Egyptian General Authority of Survey in Egypt, Umm al-Qura in Saudi Arabia, the Dubai, Kuwait and Qatar methods in those countries, Diyanet in Turkey, the Institute of Geophysics in Iran, the University of Islamic Sciences, Karachi in Pakistan, India, Bangladesh, Afghanistan and Malaysia, the Singapore (MUIS) method in Singapore, Indonesia and Brunei, ISNA in the United States and Canada, the Moonsighting Committee in the United Kingdom, and the Muslim World League everywhere else. Any of the twelve can be chosen by hand.
- **Asr.** "Standard" (Shafi'i, Maliki and Hanbali) is the default; "Hanafi" places Asr later.
- **High latitudes.** Where twilight lasts all night in summer, Fajr and Isha follow a high-latitude rule (middle of the night, one-seventh of the night, or twilight angle); "Automatic" chooses one from your latitude. Above 65° an optional setting borrows the times of the nearest latitude where the sun still rises and sets.
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
- **Backups are files you keep.** Export writes a JSON file to your device; nothing is uploaded.
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

Built with Vite, React, TypeScript, zustand and React Router (hash routes), with plain CSS design tokens and CSS modules.

## Project structure

```text
index.html                 HTML shell: meta tags, icons
vite.config.ts             Vite, the web manifest and the service worker (vite-plugin-pwa), Vitest
public/                    Icons and the service worker's notification-click handler
scripts/
  azkar/                   Fetches, builds and verifies the azkar dataset
  pwa/                     SVG icon sources and the icon generator
src/
  main.tsx                 Entry point: fonts, global styles, service-worker registration
  app/                     Routes and the app shell (tab bar)
  features/
    today/                 Home page: next prayer, today's times, azkar cards
    azkar/                 Session picker, reader, progress; data/azkar.json is the dataset
    prayer-times/          Calculation engine (engine/), location (location/), settings, reminders
    prayer-log/            Log store, statistics, calendar and log page
    settings/              Settings page, backup export and import
  pwa/                     Service-worker registration and the "new version" banner
  shared/                  i18n, design tokens and global styles, UI primitives, date and storage helpers
.github/workflows/         Build, test and deploy to GitHub Pages
```

Each feature keeps its own strings (`strings.ts`, English and Arabic), styles and tests next to its code.

## Offline use and updates

The production build registers a service worker that stores the whole app on the device at the first visit: the page, scripts, styles, icons and the Arabic fonts, about 0.9 MB in total. From then on the app opens without a connection.

When a new version has been deployed, the app downloads it in the background and shows a small "A new version is available" banner with a Reload button. It never reloads by itself, so a recitation is not interrupted; the banner waits while the reader is open. If you ignore it, the new version is used the next time the app is fully closed and reopened.

To install: in Chrome or Edge use "Install app" (or "Add to Home screen" on Android); in Safari on iPhone and iPad use Share, then "Add to Home Screen".

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs on every push to `main` (and can be started by hand from the Actions tab). It installs dependencies, lints, type-checks, tests and builds, then publishes `dist/` to GitHub Pages.

One-time setup: in the repository on GitHub open **Settings → Pages** and set **Source** to **GitHub Actions**. Until that is done the build job still passes, and only the deploy job fails.

The site is built with relative URLs and hash-based routes, so the same build works under `https://<user>.github.io/Azkar/`, at a domain root, or from any other static host: copy the contents of `dist/` there. It must be served over HTTPS for installation, offline use and location to work.

## Known limitations

- **Reminders only work while the app is open.** A web app cannot schedule a notification for a time when it is closed. Reminders arrive while Azkar is open or in a background tab, can be up to about a minute late in a throttled background tab, and are skipped when they are more than five minutes overdue (for example after the device was asleep). On iPhone and iPad notifications are only available after the app has been added to the Home Screen.
- **The Hijri date may differ from your local moon sighting.** It is calculated (Umm al-Qura calendar), not observed. Settings has an offset of up to two days either way.
- **Prayer times are a calculation.** They can differ by a few minutes from a mosque's timetable; choose its method or fine-tune the times. In Pakistan, India, Bangladesh and Afghanistan most mosques use the Hanafi Asr, which has to be switched on in Settings. Near the poles, when the sun does not rise or set, some times cannot be calculated unless the polar setting is switched on.
- **Data stays on one device.** There is no sync; use export and import to move it. Browsers may clear the storage of sites that are not installed and not visited for a long time, so export a backup now and then.
- **A place name keeps the language it was fetched in** until the location is updated.
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
| [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), with data from [GeoNames](https://www.geonames.org/) | City search | CC BY 4.0, free for non-commercial use |
| [BigDataCloud](https://www.bigdatacloud.com/) reverse geocoding | Place name for a GPS position | Free client-side API under its fair-use policy |
| The azkar and Qur'an text sources | See [Where the azkar come from](#where-the-azkar-come-from) | As listed there |

## Licence

No licence has been chosen for this project yet; that decision is the owner's. The third-party pieces listed above remain under their own licences.
