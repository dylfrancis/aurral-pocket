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
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
</p>

A React Native / [Expo](https://expo.dev) mobile client for [**Aurral**](https://github.com/lklynet/aurral) - the Artist Discovery and Request Manager for Lidarr. Browse artists and releases, manage your library, and submit requests on the go.

> Huge thanks to [@lklynet](https://github.com/lklynet) for building [Aurral](https://github.com/lklynet/aurral), this app wouldn't exist without it.

## Features

- **Discover** - surface new artists and releases
- **Library** - browse saved artists, albums, and releases
- **Search** - look up artists and navigate to their releases
- **Requests** - track the status of submitted requests
- **Settings** - permission-gated, for admin users
- **Auth** - sign-in flow with Face ID / biometric session re-auth backed by `expo-secure-store`

## Requirements

- Node.js `>= 24`
- npm
- Xcode (iOS) / Android Studio (Android) for native builds
- An iOS or Android device / simulator with a compatible [development build](https://docs.expo.dev/develop/development-builds/introduction/)

## Getting started

```bash
npm install
```

Start the Metro bundler:

```bash
npm run start
```

Run on a specific platform (requires a dev build installed on the target device/simulator):

```bash
npm run ios
npm run android
```

## Scripts

| Script    | Purpose                              |
| --------- | ------------------------------------ |
| `start`   | Start the Expo dev server            |
| `ios`     | Build and run the native iOS app     |
| `android` | Build and run the native Android app |
| `web`     | Start the web target                 |
| `lint`    | Run ESLint via `expo lint`           |
| `test`    | Run the Jest test suite              |

## Project structure

```
app/            Expo Router routes (auth + tabs: discover, library, search, requests, settings)
components/     Reusable UI components
constants/      Theme, colors, fonts
contexts/       React context providers
hooks/          Shared hooks (auth, permissions, theming, etc.)
lib/            Clients, utilities, and domain logic
plugins/        Expo config plugins (e.g. iOS fmt build fix)
assets/         Images and fonts
__tests__/      Jest tests
```

Routing is file-based via [Expo Router](https://docs.expo.dev/router/introduction). Typed routes are enabled (`app.json` → `experiments.typedRoutes`).

## Tech stack

- Expo SDK 55 / React Native 0.83 / React 19
- Expo Router (native tabs, typed routes)
- TanStack Query for data fetching
- React Hook Form + Zod for forms and validation
- Reanimated 4 + Gesture Handler + Bottom Sheet for interactions
- FlashList for virtualized lists
- Jest + `@testing-library/react-native` for tests

## Contributing

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by `commitlint`).
- `husky` + `lint-staged` format and lint staged files on commit.
- Releases are automated via [release-please](https://github.com/googleapis/release-please); see `CHANGELOG.md`.
- Known tech-debt items are tracked in [`TODO.md`](./TODO.md).

## Credits

Built on top of [Aurral](https://github.com/lklynet/aurral) by [@lklynet](https://github.com/lklynet) - all the heavy lifting (discovery, request management, Lidarr integration) lives there. Aurral Pocket is just a mobile face for it.

## License

[MIT](./LICENSE) © Dylan Francis
