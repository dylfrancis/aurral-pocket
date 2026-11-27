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
  <a href="https://github.com/sponsors/dylfrancis">
    <img src="https://img.shields.io/badge/sponsor-ea4aaa?logo=githubsponsors&logoColor=white" alt="Sponsor" />
  </a>
</p>

A mobile app for [Aurral](https://github.com/lklynet/aurral). Discover music, manage your library, and play it from your own server, online or offline.

## Install

- **iOS:** join the [TestFlight beta](https://testflight.apple.com/join/wMfHs7zE).
- **Google Play:** join the [closed testers group](https://groups.google.com/g/aurral-closed-testers) first, then opt in on the [web](https://play.google.com/apps/testing/com.aurral.aurralpocket) or in the [Play Store](https://play.google.com/store/apps/details?id=com.aurral.aurralpocket).
- **Android APK:** download it from the [latest release](https://github.com/dylfrancis/aurral-pocket/releases/latest), or add this repo to [Obtainium](https://github.com/ImranR98/Obtainium) to get each release automatically. The APK and the Play build are signed with different keys, so to switch, uninstall first. That signs you out and removes offline saves.

## Compatibility

Each release targets one Aurral version, pinned in [`.aurral-version`](./.aurral-version) (currently **3.1.0**). Older servers aren't supported. Settings → About shows the pinned version and your server's.

## Features

- **Discover:** recommendations, Made for You mixes, Your Radio, trending charts, and playlists by genre, mood and decade
- **Library:** artists, albums, songs, genres, favorites and playlists, with search, sorts and filters
- **Search:** artists, albums, songs and playlists
- **Player:** background playback, a queue, synced lyrics, radio with Autoplay, loudness levelling, and queue sync across devices
- **Offline and streaming:** save albums, playlists and songs, and set Wi-Fi and cellular streaming quality
- **Flows:** auto-generated playlists on a schedule
- **Activity:** requests and downloads grouped by what started them, with Pause and Cancel All
- **Listening:** plays go to Aurral, ListenBrainz or Koito
- **Shazam:** identify a song playing nearby, then play it or open its album or artists
- **Sign-in:** password or OIDC, biometric re-auth, and custom headers for reverse proxies such as Cloudflare Access

## Development

You need Node.js 24 or newer (`.nvmrc` pins it) and npm, Xcode for iOS, and Android Studio with JDK 17 for Android. Docker is only needed for the API contract check and the [test stack](./docs/test-stack/README.md).

The app uses native modules, so it runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not Expo Go.

```bash
npm install       # also applies the fixes in patches/
npm run ios       # or: npm run android
```

`ios/` and `android/` are generated and git-ignored. Once a build is installed, `npm run start` is enough for JavaScript changes. To get a server to point the app at, [`docs/test-stack`](./docs/test-stack/README.md) runs a throwaway Aurral in Docker.

### Android ShazamKit

Apple's license bars redistributing ShazamKit for Android, so Android builds fail until you install its `.aar`:

```bash
npm run shazam:aar -- ~/Downloads/ShazamKitAndroid2.1.1.zip
```

Song matching on Android also needs a developer token. Set `SHAZAM_KEY_ID`, `SHAZAM_TEAM_ID` and `SHAZAM_PRIVATE_KEY_PATH` in `.env.local`. [`modules/shazam/android/libs/README.md`](./modules/shazam/android/libs/README.md) has the details.

### Tailscale gateway

The in-app Tailscale connection is a Go library in [`gateway/`](./gateway), built with gomobile into `modules/tailscale`. Building it needs the Go version in `gateway/go.mod`, plus Xcode for iOS, and the Android SDK, NDK and JDK 17 for Android:

```bash
npm run gateway:build          # both platforms
npm run gateway:build -- ios   # or android
```

Run it again after changing anything in `gateway/`, then rebuild the app. Without it a local build still works, with the Tailscale switch hidden. EAS builds it in `eas-build-pre-install`, and a failure there fails the EAS build, so no release ships without Tailscale.

### Scripts

| Script               | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `start`              | Start Metro for an installed development build              |
| `ios`                | Build and run the native iOS app                            |
| `android`            | Build and run the native Android app                        |
| `web`                | Start the web target                                        |
| `lint`               | Run ESLint via `expo lint`                                  |
| `test`               | Run the Jest suite with the iOS preset                      |
| `test:android`       | Run the Jest suite with the Android preset                  |
| `check:api-contract` | Check every endpoint pocket calls against pinned Aurral     |
| `shazam:aar`         | Install the ShazamKit for Android `.aar` from a zip or file |
| `gateway:build`      | Build the Tailscale gateway for iOS, Android or both        |

CI runs both `npm test` and `npm run test:android`, so run both before pushing. It also runs the gateway's Go tests (`go test ./...` in `gateway/`).

### API contract check

`check:api-contract` calls every endpoint pocket uses on the pinned Aurral version. It fails when a route is gone, a response loses a key or changes a type, or the server reports an API version or feature pocket doesn't know. CI runs it on pull requests that touch `lib/api/`, on pushes to `main`, and weekly.

To run it locally:

```bash
docker run -d --name aurral -p 3001:3001 \
  ghcr.io/lklynet/aurral:$(cat .aurral-version)

until curl -fsS http://localhost:3001/api/health/live >/dev/null; do sleep 1; done

curl -fsS -X POST http://localhost:3001/api/onboarding/complete \
  -H 'Content-Type: application/json' \
  -d '{"authUser":"ci","authPassword":"Ci-Contract-Check-2026!",
       "downloadFolderPath":"/config/downloads"}'

AURRAL_URL=http://localhost:3001 npm run check:api-contract
docker rm -f aurral
```

Use a fresh container each time. Aurral allows 10 logins per 15 minutes, and the check calls delete and cancel routes, so never point it at a server whose data you care about. After bumping `.aurral-version` or adding a GET call, run it once with `node scripts/check-api-contract.mjs --record` to update the baseline.

### Project structure

```
app/              Expo Router routes: (auth) sign-in, and (app) with the tabs and the now playing modal
components/       UI components, grouped by feature
constants/        Theme, platform, and navigation constants
contexts/         Auth and theme providers
hooks/            Hooks, grouped by feature
lib/              API client, player, offline saves, and domain logic
modules/shazam/   Local Expo module wrapping ShazamKit on iOS and Android
modules/tailscale/ Local Expo module wrapping the Tailscale gateway
gateway/          Go: the in-app Tailscale node and its loopback proxy
plugins/          Expo config plugins (background audio)
patches/          patch-package fixes for dependencies
scripts/          API contract check, Shazam setup and the gateway build
docs/             Privacy policy and the Docker test stack
assets/           Images and fonts
__tests__/        Jest tests
test-support/     Shared Jest mocks
```

Built with Expo SDK 58 (React Native 0.88, React 19.3), Expo Router, TanStack Query, Reanimated and `react-native-nitro-player`.

## Contributing

Contributions are welcome. [CONTRIBUTING.md](./CONTRIBUTING.md) covers how to propose a change and open a pull request.

## Sponsor

If Pocket is useful to you, you can support its development through [GitHub Sponsors](https://github.com/sponsors/dylfrancis).

## AI disclosure

Pocket is built with help from AI coding agents. The maintainer decides what gets built, reviews every change, and answers for what ships. Contributors can use agents too; see [Use an AI agent](./CONTRIBUTING.md#use-an-ai-agent).

## Credits

Built on [Aurral](https://github.com/lklynet/aurral) by [@lklynet](https://github.com/lklynet), which does the heavy lifting: discovery, downloads, library management and streaming.

## License

[MIT](./LICENSE) © Dylan Francis
