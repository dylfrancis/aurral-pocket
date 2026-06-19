/* global __dirname */
// Extends the static app.json. Expo loads app.json and passes it here as
// `config`, with .env / .env.local already merged into process.env.
//
// Shazam (Android) needs a developer token. In CI/EAS we inject a pre-minted
// SHAZAM_DEVELOPER_TOKEN; locally you just provide the minting inputs in
// .env.local (SHAZAM_KEY_ID, SHAZAM_TEAM_ID, SHAZAM_PRIVATE_KEY_PATH) and the
// token is minted here at config time. The .p8 never lands in the repo/binary.
// iOS ignores the token (catalog access rides the app entitlement).
const path = require("path");
const { mintFromEnv } = require("./scripts/shazam-token.cjs");

function resolveShazamToken() {
  try {
    // Resolve a relative .p8 path against the project root, since the native
    // build evaluates this config from a different working directory than the
    // CLI — a relative path would otherwise fail to read during the build.
    const keyPath = process.env.SHAZAM_PRIVATE_KEY_PATH;
    if (keyPath && !path.isAbsolute(keyPath)) {
      process.env.SHAZAM_PRIVATE_KEY_PATH = path.resolve(__dirname, keyPath);
    }
    return mintFromEnv();
  } catch (err) {
    console.warn(`Shazam token unavailable: ${err.message}`);
    return null;
  }
}

module.exports = ({ config }) => {
  // release-please bumps app.json's version, and on the `test` track that's a
  // prerelease string like "0.10.0-test". iOS CFBundleShortVersionString only
  // accepts one-to-three dot-separated integers, so strip any prerelease/build
  // suffix for the native marketing version. The full string is preserved in
  // `extra.fullVersion` so the About screen can still show "-test" on QA builds.
  const fullVersion = config.version;
  if (typeof config.version === "string") {
    config.version = config.version.split("-")[0];
  }

  config.extra = {
    ...(config.extra ?? {}),
    fullVersion,
    shazamDeveloperToken: resolveShazamToken(),
  };
  return config;
};
