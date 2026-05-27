# ShazamKit for Android SDK

ShazamKit for Android is **not** on a public Maven repo — Apple ships it as an
auth-gated `.zip` (containing the `.aar`), and its license bars redistribution,
so the `.aar` is **git-ignored** and never committed.

## Where to download

- Browse versions: <https://developer.apple.com/download/all/?q=Android%20ShazamKit>
  (requires signing in with your Apple Developer account).
- Direct example (latest at time of writing):
  `ShazamKitAndroid2.1.1.zip` — the `.aar` is inside the zip.

## Install it (local)

From the repo root, point the setup script at the downloaded zip (or an
already-extracted `.aar`):

```bash
npm run shazam:aar -- ~/Downloads/ShazamKitAndroid2.1.1.zip
```

It extracts the `.aar` into this folder. `npm run android` will then compile.
The Gradle config in `../build.gradle` picks up any `*.aar` here via `flatDir`,
so the version in the filename doesn't matter. Because `flatDir` AARs carry no
transitive POM, `build.gradle` declares ShazamKit's deps (Kotlin Coroutines,
OkHttp, Retrofit) explicitly — bump those there if a new SDK version needs it.

## Install it (EAS / CI)

The same script runs automatically as the `eas-build-pre-install` hook **on the
EAS build server** (after `eas build` uploads the project — so it works whether
the build is triggered locally or from GitHub Actions). The `.aar` is ~2.8 MB,
which exceeds the EAS file-variable limit (32 KiB), so host it privately and let
the hook fetch it.

Recommended: a **release asset in a private GitHub repo**, fetched with a token.

1. Create a private repo (e.g. `aurral-pocket-assets`), make a release, and
   upload `shazamkit-android-release.aar` as an asset. Note the asset ID
   (`gh api repos/OWNER/REPO/releases/latest` lists `assets[].id`).
2. Create a fine-grained PAT with read-only **Contents** on that repo.
3. Add both as EAS environment variables (production + preview):

```bash
eas env:create --name SHAZAM_AAR_URL \
  --value "https://api.github.com/repos/OWNER/aurral-pocket-assets/releases/assets/ASSET_ID" \
  --environment production --environment preview --visibility secret

eas env:create --name SHAZAM_AAR_TOKEN --value "github_pat_…" \
  --environment production --environment preview --visibility secret
```

The hook downloads the bare `.aar` (use a `.zip` URL only if you host the Apple
zip). `SHAZAM_AAR_TOKEN` is optional — omit it for hosts whose URL already
carries auth (e.g. an S3/R2 presigned URL). The hook no-ops on iOS builds and
when an `.aar` is already present.

## Why a developer token is still required

The SDK reaches Apple's Shazam catalog using a developer token (an ES256 JWT
signed by an Apple media-identifier `.p8` key). The token is minted at build
time (see `scripts/mint-shazam-token.mjs` / `scripts/shazam-token.cjs`) and
passed from JS into `startListening(developerToken)`. iOS does not need this —
catalog access there rides the app's ShazamKit App Service.
