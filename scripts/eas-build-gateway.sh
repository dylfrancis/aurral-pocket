#!/usr/bin/env bash
# Part of eas-build-pre-install: builds the Tailscale gateway for the platform
# EAS is building, with the Go version gateway/go.mod names. EAS images have
# no Go, so it downloads that release from go.dev and checks its SHA-256
# against go.dev's own listing before using it.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
platform="${EAS_BUILD_PLATFORM:?EAS_BUILD_PLATFORM is not set}"
version="$(awk '/^go /{print $2; exit}' "$root/gateway/go.mod")"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) target="darwin-arm64" ;;
  Darwin-x86_64) target="darwin-amd64" ;;
  Linux-x86_64) target="linux-amd64" ;;
  Linux-aarch64) target="linux-arm64" ;;
  *) echo "No Go download for $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

archive="go${version}.${target}.tar.gz"
tools="${TMPDIR:-/tmp}/aurral-go-${version}"
if [[ ! -x "$tools/go/bin/go" ]]; then
  mkdir -p "$tools"
  curl -fsSL "https://go.dev/dl/${archive}" -o "$tools/$archive"
  expected="$(curl -fsSL 'https://go.dev/dl/?mode=json&include=all' |
    node -e '
      const [name] = process.argv.slice(1);
      let body = "";
      process.stdin.on("data", (chunk) => (body += chunk));
      process.stdin.on("end", () => {
        for (const release of JSON.parse(body)) {
          const file = release.files.find((f) => f.filename === name);
          if (file) return process.stdout.write(file.sha256);
        }
        process.exit(1);
      });
    ' "$archive")"
  actual="$(shasum -a 256 "$tools/$archive" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Checksum mismatch for $archive" >&2
    exit 1
  fi
  tar -xzf "$tools/$archive" -C "$tools"
  rm -f "$tools/$archive"
fi
export PATH="$tools/go/bin:$PATH"
export GOTOOLCHAIN=local

bash "$root/scripts/build-tailscale-gateway.sh" "$platform"
