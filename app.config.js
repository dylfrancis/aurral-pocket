// Extends the static app.json. Expo loads app.json and passes it here as
// `config`; we inject the Shazam developer token from the build environment so
// the .p8-derived JWT never lives in the committed config or the repo.
//
// The token is minted at build time (scripts/mint-shazam-token.mjs) and exposed
// to the build as SHAZAM_DEVELOPER_TOKEN (an EAS secret / CI env var). It is
// only consumed on Android — iOS reaches the Shazam catalog via its entitlement.
module.exports = ({ config }) => {
  config.extra = {
    ...(config.extra ?? {}),
    shazamDeveloperToken: process.env.SHAZAM_DEVELOPER_TOKEN ?? null,
  };
  return config;
};
