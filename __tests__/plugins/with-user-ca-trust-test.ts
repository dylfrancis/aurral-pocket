const {
  setNetworkSecurityConfig,
  NETWORK_SECURITY_CONFIG,
} = require("@/plugins/with-user-ca-trust");

describe("with-user-ca-trust", () => {
  it("points the application at the network security config, once", () => {
    const manifest = { manifest: { application: [{ $: {} }] } };

    setNetworkSecurityConfig(manifest);
    setNetworkSecurityConfig(manifest);

    expect(manifest.manifest.application[0].$).toEqual({
      "android:networkSecurityConfig": "@xml/network_security_config",
    });
  });

  it("trusts user-installed CAs alongside the system store and keeps cleartext", () => {
    expect(NETWORK_SECURITY_CONFIG).toContain('<certificates src="system" />');
    expect(NETWORK_SECURITY_CONFIG).toContain('<certificates src="user" />');
    expect(NETWORK_SECURITY_CONFIG).toContain(
      'cleartextTrafficPermitted="true"',
    );
  });
});
