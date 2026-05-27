# ShazamKit for Android SDK

ShazamKit for Android is **not** published to a public Maven repository — Apple
distributes it as an `.aar` you download manually.

## Setup

1. Download the ShazamKit Android SDK from
   <https://developer.apple.com/shazamkit/android/>.
2. Drop the `.aar` file into this directory (`modules/shazam/android/libs/`).
3. Rebuild the Android app (`npm run android` / EAS build).

The Gradle config in `../build.gradle` picks up any `*.aar` in this folder via
`flatDir`. The file itself is intentionally **not** committed (see
`.gitignore`); CI/EAS builds must fetch it as part of the build setup.

## Why a developer token is still required

The SDK reaches Apple's Shazam catalog using a developer token (an ES256 JWT
signed by an Apple _media identifier_ `.p8` key). The token is minted at build
time (see `scripts/mint-shazam-token.mjs`) and passed from JS into
`startListening(developerToken)`. iOS does not need this — catalog access there
rides the app's ShazamKit entitlement.
