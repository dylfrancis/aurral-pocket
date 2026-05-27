#!/usr/bin/env node
// Mints an Apple "media identifier" developer token (ES256 JWT) for ShazamKit
// on Android. Apple caps these at ~6 months, so this is run at build time and
// rotated on a schedule (see .github/workflows/rotate-shazam-token.yml).
//
// The token grants only Shazam catalog matching, but the .p8 private key that
// signs it must NEVER be committed or shipped. Provide inputs via env:
//
//   SHAZAM_MEDIA_ID            Media identifier ID (becomes the JWT `kid`)
//   SHAZAM_TEAM_ID             Apple Team ID (becomes the JWT `iss`)
//   SHAZAM_PRIVATE_KEY         The .p8 PEM contents, OR
//   SHAZAM_PRIVATE_KEY_PATH    Path to the .p8 file
//   SHAZAM_TOKEN_TTL_SECONDS   Optional; defaults to 180 days (max ~15777000)
//
// Prints the token to stdout (diagnostics go to stderr) so CI can capture it:
//   SHAZAM_DEVELOPER_TOKEN="$(node scripts/mint-shazam-token.mjs)"

import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const MAX_TTL_SECONDS = 15_777_000; // Apple's ~6-month ceiling.
const DEFAULT_TTL_SECONDS = 180 * 24 * 60 * 60;

function fail(message) {
  console.error(`mint-shazam-token: ${message}`);
  process.exit(1);
}

const mediaId = process.env.SHAZAM_MEDIA_ID;
const teamId = process.env.SHAZAM_TEAM_ID;
if (!mediaId) fail("SHAZAM_MEDIA_ID is required");
if (!teamId) fail("SHAZAM_TEAM_ID is required");

let privateKeyPem = process.env.SHAZAM_PRIVATE_KEY;
if (!privateKeyPem && process.env.SHAZAM_PRIVATE_KEY_PATH) {
  privateKeyPem = readFileSync(process.env.SHAZAM_PRIVATE_KEY_PATH, "utf8");
}
if (!privateKeyPem) {
  fail("Provide SHAZAM_PRIVATE_KEY or SHAZAM_PRIVATE_KEY_PATH");
}

const ttl = Math.min(
  Number(process.env.SHAZAM_TOKEN_TTL_SECONDS) || DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
);

const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid: mediaId };
const payload = { iss: teamId, iat: now, exp: now + ttl };

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
  JSON.stringify(payload),
)}`;

let signature;
try {
  const keyObject = crypto.createPrivateKey(privateKeyPem);
  // `ieee-p1363` yields the raw R||S signature JOSE/JWT requires (not DER).
  signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: keyObject,
    dsaEncoding: "ieee-p1363",
  });
} catch (err) {
  fail(`failed to sign token: ${err.message}`);
}

const token = `${signingInput}.${base64url(signature)}`;

const expiresAt = new Date((now + ttl) * 1000).toISOString();
console.error(`mint-shazam-token: minted token expiring ${expiresAt}`);
process.stdout.write(token);
