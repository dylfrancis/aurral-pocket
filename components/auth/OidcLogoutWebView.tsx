import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { useAuth } from "@/contexts/auth-context";
import { isHttpUrl } from "@/lib/oidc";

const LOGOUT_TIMEOUT_MS = 8000;

/**
 * Visits the identity provider's logout URL when a session ends.
 *
 * This cannot go through the app's HTTP client: the provider's session cookie
 * lives in the WebView's cookie store, and only a request from that store can
 * clear it. `react-native-webview` is no help either — its `clearCache` omits
 * `WKWebsiteDataTypeCookies` on iOS.
 *
 * Mounted above the router, so it survives the navigation to the login screen
 * that sign-out triggers.
 *
 * Known gap: `OIDC_LOGOUT_URL` is optional on the server. Unset, Aurral reports
 * no logout URL, nothing runs here, and the provider session outlives Aurral's.
 */
export function OidcLogoutWebView() {
  const { pendingOidcLogoutUrl, finishOidcLogout } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url =
    pendingOidcLogoutUrl && isHttpUrl(pendingOidcLogoutUrl)
      ? pendingOidcLogoutUrl
      : null;

  // A provider that never answers must not leave the view mounted for good.
  useEffect(() => {
    if (!pendingOidcLogoutUrl) return;
    timer.current = setTimeout(finishOidcLogout, LOGOUT_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pendingOidcLogoutUrl, finishOidcLogout]);

  // A rejected URL still has to clear, or it sits pending forever.
  useEffect(() => {
    if (pendingOidcLogoutUrl && !url) finishOidcLogout();
  }, [pendingOidcLogoutUrl, url, finishOidcLogout]);

  const handleDone = useCallback(() => {
    finishOidcLogout();
  }, [finishOidcLogout]);

  if (!url) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <WebView
        source={{ uri: url }}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled
        javaScriptEnabled
        onLoadEnd={handleDone}
        onError={handleDone}
        testID="oidc-logout-webview"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Off-screen rather than zero-sized: some WebViews skip layout, and never
  // load, when a view has no dimensions.
  host: {
    position: "absolute",
    left: -1,
    top: -1,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
