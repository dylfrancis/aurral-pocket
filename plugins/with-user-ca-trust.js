const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * Trust certificate authorities the user installed on the device.
 *
 * Since Android 7 an app trusts only the system CA store unless its network
 * security config says otherwise. People self-host Aurral behind a private CA
 * (Caddy's local CA, step-ca, a home-lab root), install that root under
 * Settings > Security, and still see every request fail. This config adds the
 * user store as a trust anchor next to the system one. Cleartext stays
 * allowed, as before, so plain-http LAN servers keep working.
 */

const CONFIG_NAME = "network_security_config";

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

/** Point the application at the config, once. */
function setNetworkSecurityConfig(androidManifest) {
  const app = androidManifest.manifest.application?.[0];
  if (app) {
    app.$["android:networkSecurityConfig"] = `@xml/${CONFIG_NAME}`;
  }
  return androidManifest;
}

const withUserCaTrust = (config) => {
  config = withAndroidManifest(config, (cfg) => {
    setNetworkSecurityConfig(cfg.modResults);
    return cfg;
  });
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${CONFIG_NAME}.xml`),
        NETWORK_SECURITY_CONFIG,
      );
      return cfg;
    },
  ]);
};

module.exports = createRunOncePlugin(
  withUserCaTrust,
  "with-user-ca-trust",
  "1.0.0",
);
module.exports.setNetworkSecurityConfig = setNetworkSecurityConfig;
module.exports.NETWORK_SECURITY_CONFIG = NETWORK_SECURITY_CONFIG;
