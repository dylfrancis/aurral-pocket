#!/usr/bin/env node
// Places the ShazamKit for Android SDK .aar into modules/shazam/android/libs/.
//
// Apple ships the SDK as an auth-gated download (a .zip containing the .aar),
// and its license bars redistribution, so we never commit it. This script
// sources it from one of (in order):
//
//   1. a path argument:   npm run shazam:aar -- ~/Downloads/ShazamKitAndroid2.1.1.zip
//   2. SHAZAM_AAR_FILE:    a path — e.g. an EAS file-type env var (recommended for CI)
//   3. SHAZAM_AAR_URL:     a private URL you control
//
// It accepts either a .zip (extracts the .aar) or a bare .aar. It no-ops when
// an .aar is already present, or on iOS/web builds where it isn't needed.

import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIBS_DIR = join(ROOT, "modules", "shazam", "android", "libs");

const log = (msg) => console.log(`setup-shazam-aar: ${msg}`);

function hasAar() {
  return (
    existsSync(LIBS_DIR) &&
    readdirSync(LIBS_DIR).some((f) => f.endsWith(".aar"))
  );
}

function extractZip(zipPath) {
  // -j flattens paths, '*.aar' extracts only the library.
  execFileSync("unzip", ["-o", "-j", zipPath, "*.aar", "-d", LIBS_DIR], {
    stdio: "inherit",
  });
}

async function download(url) {
  log(`downloading from ${url.replace(/\?.*$/, "?…")}`);
  // SHAZAM_AAR_TOKEN enables private hosts; the octet-stream Accept is what a
  // GitHub release-asset API URL needs to return the binary (not JSON).
  const token = process.env.SHAZAM_AAR_TOKEN;
  const headers = token
    ? { Authorization: `Bearer ${token}`, Accept: "application/octet-stream" }
    : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Host the bare .aar (default); only treat an explicit .zip as an archive.
  const ext = url.toLowerCase().includes(".zip") ? ".zip" : ".aar";
  const dest = join(tmpdir(), `shazamkit-android${ext}`);
  writeFileSync(dest, buf);
  return dest;
}

async function main() {
  if (hasAar()) {
    log("an .aar is already present — skipping");
    return;
  }

  mkdirSync(LIBS_DIR, { recursive: true });

  const source =
    process.argv[2] ||
    process.env.SHAZAM_AAR_FILE ||
    process.env.SHAZAM_AAR_URL;
  if (!source) {
    if (process.env.EAS_BUILD_PLATFORM === "ios") {
      log("iOS build — .aar not needed, skipping");
      return;
    }
    log(
      "no .aar found and no source given (pass a zip path, or set SHAZAM_AAR_FILE / SHAZAM_AAR_URL). " +
        "Android builds will fail until it's installed. See modules/shazam/android/libs/README.md",
    );
    return;
  }

  const isUrl = /^https?:\/\//.test(source);
  const localPath = isUrl ? await download(source) : source;

  // Optional integrity check (the digest of the downloaded artifact — i.e. the
  // bare .aar when hosting it directly).
  const expectedSha = process.env.SHAZAM_AAR_SHA256;
  if (expectedSha) {
    const actual = createHash("sha256")
      .update(readFileSync(localPath))
      .digest("hex");
    if (actual !== expectedSha.toLowerCase()) {
      throw new Error(
        `sha256 mismatch: expected ${expectedSha}, got ${actual}`,
      );
    }
    log("sha256 verified");
  }

  if (localPath.toLowerCase().endsWith(".zip")) {
    extractZip(localPath);
  } else {
    copyFileSync(localPath, join(LIBS_DIR, basename(localPath)));
  }

  if (!hasAar()) {
    throw new Error("no .aar was extracted/copied — check the source contents");
  }
  log("installed ShazamKit .aar");
}

main().catch((err) => {
  console.error(`setup-shazam-aar: ${err.message}`);
  process.exit(1);
});
