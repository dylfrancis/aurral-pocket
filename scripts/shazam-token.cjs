// Shared ES256 minting for Apple media-identifier developer tokens (ShazamKit
// on Android). CommonJS so both the CLI (scripts/mint-shazam-token.mjs) and
// app.config.js can use it. The .p8 private key must never be committed.
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const { readFileSync } = require("node:fs");

const MAX_TTL_SECONDS = 15_777_000; // Apple's ~6-month ceiling.
const DEFAULT_TTL_SECONDS = 180 * 24 * 60 * 60;

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Sign a developer token.
 * @param {object} opts
 * @param {string} opts.keyId  10-char Key ID (the .p8's id; the JWT `kid`)
 * @param {string} opts.teamId Apple Team ID (the JWT `iss`)
 * @param {string} opts.privateKeyPem  .p8 PEM contents
 * @param {number} [opts.ttlSeconds]
 * @returns {string} the signed JWT
 */
function mintShazamToken({ keyId, teamId, privateKeyPem, ttlSeconds }) {
  if (!keyId) throw new Error("keyId is required");
  if (!teamId) throw new Error("teamId is required");
  if (!privateKeyPem) throw new Error("privateKeyPem is required");

  const ttl = Math.min(
    Number(ttlSeconds) || DEFAULT_TTL_SECONDS,
    MAX_TTL_SECONDS,
  );
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: now, exp: now + ttl };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;
  // `ieee-p1363` yields the raw R||S signature JWT requires (not DER).
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: crypto.createPrivateKey(privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Resolve token inputs from environment variables and mint, returning `null`
 * when inputs are absent (so callers can no-op gracefully). Accepts a
 * pre-minted SHAZAM_DEVELOPER_TOKEN, else mints from key/team/.p8.
 */
function mintFromEnv(env = process.env) {
  if (env.SHAZAM_DEVELOPER_TOKEN) return env.SHAZAM_DEVELOPER_TOKEN;

  const keyId = env.SHAZAM_KEY_ID || env.SHAZAM_MEDIA_ID;
  const teamId = env.SHAZAM_TEAM_ID;
  const privateKeyPem =
    env.SHAZAM_PRIVATE_KEY ||
    (env.SHAZAM_PRIVATE_KEY_PATH
      ? readFileSync(env.SHAZAM_PRIVATE_KEY_PATH, "utf8")
      : null);

  if (!keyId || !teamId || !privateKeyPem) return null;

  return mintShazamToken({
    keyId,
    teamId,
    privateKeyPem,
    ttlSeconds: env.SHAZAM_TOKEN_TTL_SECONDS,
  });
}

module.exports = {
  mintShazamToken,
  mintFromEnv,
  MAX_TTL_SECONDS,
  DEFAULT_TTL_SECONDS,
};
