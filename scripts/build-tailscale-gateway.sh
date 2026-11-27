#!/usr/bin/env bash
# Builds gateway/ with gomobile into the Tailscale module's native libraries:
#   ios      modules/tailscale/ios/Gateway.xcframework
#   android  modules/tailscale/android/libs/gateway.aar
# Pass ios, android or both (the default). Needs the Go in gateway/go.mod,
# Xcode for iOS, and the Android SDK, NDK and a JDK for Android. Both outputs
# are git-ignored; without them the app builds with Tailscale unavailable.
set -euo pipefail

platforms="${1:-all}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/gateway"

# gomobile and gobind are pinned as tools in go.mod.
export GOBIN="$root/gateway/.bin"
go install tool
export PATH="$GOBIN:$PATH"

# ts_omit_logtail leaves out tsnet's upload of logs to log.tailscale.com.
common=(-tags=ts_omit_logtail -trimpath)

if [[ "$platforms" == "ios" || "$platforms" == "all" ]]; then
  out="$root/modules/tailscale/ios/Gateway.xcframework"
  rm -rf "$out"
  gomobile bind -target=ios/arm64,iossimulator/arm64 -iosversion=16.4 \
    "${common[@]}" -ldflags="-s -w" -o "$out" .
  echo "Built $out"
fi

if [[ "$platforms" == "android" || "$platforms" == "all" ]]; then
  out="$root/modules/tailscale/android/libs/gateway.aar"
  mkdir -p "$(dirname "$out")"
  rm -f "$out" "${out%.aar}-sources.jar"
  # Every ABI the app ships (gradle.properties' reactNativeArchitectures).
  # Google Play needs 16 KB pages, which NDK 27's linker doesn't default to.
  gomobile bind -target=android/arm64,android/arm,android/amd64,android/386 \
    -androidapi=24 -javapkg=com.aurral "${common[@]}" \
    -ldflags="-s -w -extldflags=-Wl,-z,max-page-size=16384" -o "$out" .
  rm -f "${out%.aar}-sources.jar"
  echo "Built $out"
fi
