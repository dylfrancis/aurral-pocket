<p align="center">
  <img src="./assets/images/aurral-logo.svg" alt="Aurral Pocket" width="160" />
</p>

<h1 align="center">Aurral Pocket</h1>

<p align="center">
  <a href="https://github.com/dylfrancis/aurral-pocket/releases/latest">
    <img src="https://img.shields.io/github/v/release/dylfrancis/aurral-pocket?label=release" alt="Latest release" />
  </a>
  <a href="https://github.com/dylfrancis/aurral-pocket/actions/workflows/test.yml">
    <img src="https://github.com/dylfrancis/aurral-pocket/actions/workflows/test.yml/badge.svg?branch=main" alt="Tests" />
  </a>
  <a href="https://github.com/dylfrancis/aurral-pocket/actions/workflows/api-contract.yml">
    <img src="https://github.com/dylfrancis/aurral-pocket/actions/workflows/api-contract.yml/badge.svg?branch=main" alt="API contract" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
</p>

A React Native / [Expo](https://expo.dev) mobile client for [**Aurral**](https://github.com/lklynet/aurral) - find new music, get it, and play it, all on your own server. Discover artists, manage your library and requests, and play your music on the go, online or offline.

> Huge thanks to [@lklynet](https://github.com/lklynet) for building [Aurral](https://github.com/lklynet/aurral), this app wouldn't exist without it.

## Try the app

Want to test a build without setting up the dev environment? Join one of the testing tracks below.

### iOS (TestFlight)

Install [TestFlight](https://apps.apple.com/app/testflight/id899247664) from the App Store, then join via:

- **TestFlight invite:** https://testflight.apple.com/join/wMfHs7zE

### Android (closed testing)

Android requires closed testing before the app can be approved for open testing and production, so testers must join the Google Group before getting access to the app.

1. Join the Aurral Closed Testers group: https://groups.google.com/g/aurral-closed-testers
2. Once you have joined, opt in to the test:
   - **Web:** https://play.google.com/apps/testing/com.aurral.aurralpocket
   - **Play Store:** https://play.google.com/store/apps/details?id=com.aurral.aurralpocket

> Note: you must join the group before the Play Store / web links will work.

## Compatibility

Each release is built and tested against one Aurral version, pinned in [`.aurral-version`](./.aurral-version) (currently **2.13.0**). Settings → About shows both that version and the one your server runs. Older servers are not supported.

## Features

- **Discover** - recommendations grouped by why they showed up, trending charts, editorial playlists, recent releases, shows near you, and tag browsing, with a customizable layout
- **Library** - artists, albums, genres, favorites, playlists, and your blocklist; album pages tint to their cover
- **Search** - find artists and albums and add them to your library
- **Flows** - scheduled, auto-generated playlists that mix discovery, trending, tags, and related artists; start from a template, preview picks before they download, and stop or retry single tracks
- **Player** - stream your library, flows, and playlists with background playback, a queue (play next, add to queue), and a full-screen now playing sheet
- **Offline** - save albums, playlists, and songs to the device; Settings → Playback and Storage sets prefetching and the cache size
- **Activity** - follow requests and downloads in Queue, Review, and History, filter by status, and spot quality upgrades
- **Listening** - plays are reported to Aurral and your scrobblers; connect ListenBrainz or Koito from Settings → Listening
- **Shazam** - identify songs playing around you with ShazamKit, then open the album or any credited artist, play the song if you own it, or add it to a playlist
- **Sign-in** - password or OIDC, Face ID / biometric re-auth, and custom headers for reverse proxies such as Cloudflare Access

On iOS, Activity and Settings are tabs (in the More list on iPhone). On Android, they open from the ⋮ menu on each tab.

## Requirements

- Node.js `>= 24` (`.nvmrc` pins the exact version) and npm
- Xcode for iOS builds
- Android Studio and JDK 17 for Android builds
- For Android builds, the ShazamKit for Android `.aar` (see [below](#android-shazamkit))
- Docker, only for the [API contract check](#api-contract-check) and the [test stack](./docs/test-stack/README.md)

The app uses native modules, so it runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not Expo Go.

## Getting started

```bash
npm install
```

`npm install` also applies the fixes in `patches/` through `patch-package`.

Build the native app, install it on a simulator or device, and start Metro:

```bash
npm run ios
npm run android
```

`ios/` and `android/` are generated from `app.json` and the config plugins, and are git-ignored. Once a development build is installed, `npm run start` is enough for JavaScript-only changes.

Need a server to point the app at? [`docs/test-stack`](./docs/test-stack/README.md) runs a throwaway Aurral + Lidarr stack in Docker.

### Android ShazamKit

Apple's license bars redistributing ShazamKit for Android, so its `.aar` is git-ignored, and Android builds fail until it is installed. Download the SDK from Apple's developer site and run:

```bash
npm run shazam:aar -- ~/Downloads/ShazamKitAndroid2.1.1.zip
```

[`modules/shazam/android/libs/README.md`](./modules/shazam/android/libs/README.md) covers where to download it and how EAS builds fetch it.

Shazam on Android also needs a developer token. To mint one locally, set `SHAZAM_KEY_ID`, `SHAZAM_TEAM_ID`, and `SHAZAM_PRIVATE_KEY_PATH` (a media-identifier `.p8` key) in `.env.local`; `app.config.js` mints the token at config time. Without them the app builds and runs, but Android song matching fails. iOS needs no token.

## Scripts

| Script               | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `start`              | Start Metro for an installed development build              |
| `ios`                | Build and run the native iOS app                            |
| `android`            | Build and run the native Android app                        |
| `web`                | Start the web target                                        |
| `lint`               | Run ESLint via `expo lint`                                  |
| `test`               | Run the Jest suite with the iOS preset                      |
| `test:android`       | Run the Jest suite with the Android preset                  |
| `check:api-contract` | Verify every endpoint pocket calls (see below)              |
| `shazam:aar`         | Install the ShazamKit for Android `.aar` from a zip or file |

CI runs both `npm test` and `npm run test:android` on every pull request, so run both before pushing.

## API contract check

Aurral 2.0 moved the weekly-flow router to `/playlists` and deleted
`/search/artists`. Neither broke the build — the client kept compiling and only
failed as a 404 on a user's device. `check:api-contract` catches that class of
drift by booting the Aurral version we target and calling every endpoint pocket
uses.

The pinned version lives in `.aurral-version`. Bumping it is the deliberate act
of retargeting a new Aurral release; CI fails if pocket has not caught up.

Run it locally against a throwaway container:

```bash
docker run -d --name aurral -p 3001:3001 \
  ghcr.io/lklynet/aurral:$(cat .aurral-version)

# Wait for the server to come up.
until curl -fsS http://localhost:3001/api/health/live >/dev/null; do sleep 1; done

# Onboarding demands Lidarr credentials, but passing both profile IDs
# short-circuits the lookup, so no Lidarr instance is required.
curl -fsS -X POST http://localhost:3001/api/onboarding/complete \
  -H 'Content-Type: application/json' \
  -d '{"authUser":"ci","authPassword":"Ci-Contract-Check-2026!",
       "lidarr":{"url":"http://lidarr.invalid:8686","apiKey":"ci-stub-key",
                 "qualityProfileId":1,"metadataProfileId":1},
       "downloadFolderPath":"/config/downloads"}'

AURRAL_URL=http://localhost:3001 npm run check:api-contract
docker rm -f aurral
```

Start a **fresh container per run** — Aurral rate-limits logins to 10 per 15
minutes, and a reused container will eventually refuse to authenticate. The
check probes `DELETE` and cancel routes with synthetic IDs, so never point it at
a server with data you care about.

What the check enforces:

- **Routes exist.** A route counts as missing only when Aurral answers with its
  catch-all `{"error":"Not found"}`. Anything else — including `400` for a
  synthetic ID or `401` — means the route exists. Endpoints that answer only via
  a redirect fail too: a compatibility shim is not a contract.
- **Response shapes hold.** For GET routes that answer 200 with JSON, the key
  paths and value types are compared against
  [`scripts/api-contract-baseline.json`](./scripts/api-contract-baseline.json).
  A key that disappears or changes type fails; a new key is only reported.
- **The app contract matches.** Routes in Aurral's
  [app contract](https://docs.aurral.org/api/app-contract/) are marked
  `contract`, and the fields the contract guarantees must be present. The
  contract version and feature names from `/health/bootstrap` must match what
  pocket knows, so a new version or feature fails the check.

After bumping `.aurral-version`, or adding a GET call, re-record the baseline
right after onboarding a fresh container:

```bash
AURRAL_URL=http://localhost:3001 node scripts/check-api-contract.mjs --record
```

In CI, the check runs on pull requests that touch `lib/api/`, on pushes to
`main`, and weekly. An advisory job also runs it against Aurral `latest`; on
`main`, any drift it finds lands in an open `api-drift` issue instead of a red
build.

## Project structure

```
app/              Expo Router routes: (auth) sign-in, and (app) with the tabs and the now playing modal
components/       UI components, grouped by feature
constants/        Theme, platform, and navigation constants
contexts/         Auth and theme providers
hooks/            Hooks, grouped by feature
lib/              API client, player, offline saves, and domain logic
modules/shazam/   Local Expo module wrapping ShazamKit on iOS and Android
plugins/          Expo config plugins (background audio)
patches/          patch-package fixes for dependencies
scripts/          API contract check and Shazam setup
docs/             Privacy policy and the Docker test stack
assets/           Images and fonts
__tests__/        Jest tests
test-support/     Shared Jest mocks
```

Routing is file-based via [Expo Router](https://docs.expo.dev/router/introduction). The tabs are Discover, Library, Search, and Flows, plus Activity and Settings, which are tabs on iOS and stack screens on Android. Typed routes and the React Compiler are enabled in `app.json` → `experiments`.

## Tech stack

- Expo SDK 58 / React Native 0.88 / React 19.3, with the React Compiler
- Expo Router (native tabs, typed routes)
- `@expo/ui` for native SwiftUI and Jetpack Compose controls
- TanStack Query for data fetching
- React Hook Form + Zod for forms and validation
- Reanimated 4 + Gesture Handler + Bottom Sheet for interactions
- FlashList for virtualized lists
- `react-native-nitro-player` for playback, and `expo-file-system` for offline saves
- Jest + `@testing-library/react-native` for tests

## Contributing

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by `commitlint`).
- `husky` + `lint-staged` format and lint staged files on commit.
- Releases are automated via [release-please](https://github.com/googleapis/release-please): `main` cuts stable releases and `test` cuts `-test` prereleases. See `CHANGELOG.md`.
- Known tech-debt items are tracked in [`TODO.md`](./TODO.md).

## Credits

Built on top of [Aurral](https://github.com/lklynet/aurral) by [@lklynet](https://github.com/lklynet) - all the heavy lifting (discovery, downloads, library management, streaming) lives there. Aurral Pocket is just a mobile face for it.

## License

[MIT](./LICENSE) © Dylan Francis
