#!/usr/bin/env node
// Mints an Apple media-identifier developer token (ES256 JWT) for ShazamKit on
// Android. Apple caps these at ~6 months, so it's run at build time and rotated
// on a schedule (see .github/workflows/rotate-shazam-token.yml).
//
// The .p8 private key that signs it must NEVER be committed or shipped. Inputs:
//
//   SHAZAM_KEY_ID              10-char Key ID of the .p8 (the JWT `kid`)
//   SHAZAM_TEAM_ID             Apple Team ID (the JWT `iss`)
//   SHAZAM_PRIVATE_KEY         the .p8 PEM contents, OR
//   SHAZAM_PRIVATE_KEY_PATH    path to the .p8 file
//   SHAZAM_TOKEN_TTL_SECONDS   optional; defaults to 180 days (max ~15777000)
//
// Prints the token to stdout (diagnostics to stderr) so CI can capture it:
//   SHAZAM_DEVELOPER_TOKEN="$(node scripts/mint-shazam-token.mjs)"

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { mintFromEnv } = require("./shazam-token.cjs");

try {
  const token = mintFromEnv();
  if (!token) {
    console.error(
      "mint-shazam-token: missing inputs (need SHAZAM_KEY_ID, SHAZAM_TEAM_ID, and SHAZAM_PRIVATE_KEY[_PATH])",
    );
    process.exit(1);
  }
  process.stdout.write(token);
} catch (err) {
  console.error(`mint-shazam-token: ${err.message}`);
  process.exit(1);
}
