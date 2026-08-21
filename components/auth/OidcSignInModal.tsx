import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview/lib/WebViewTypes";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  buildOidcExchangePageUrl,
  buildOidcExchangeScript,
  buildOidcLoginUrl,
  isOidcCompleteUrl,
  isServerOrigin,
  parseOidcMessage,
  readOidcCompletion,
} from "@/lib/oidc";
import type { OidcSession } from "@/lib/types/auth";

type Phase = "authorizing" | "exchanging";

type Props = {
  visible: boolean;
  serverUrl: string;
  onClose: () => void;
  onSession: (session: OidcSession) => void;
};

/**
 * Runs the Aurral OIDC flow in a WebView and reports the session back. See
 * `lib/oidc.ts` for why it cannot go through `expo-auth-session`.
 *
 * One WebView instance serves both phases: the exchange needs the transaction
 * cookie the login step set, and remounting would drop it.
 *
 * Its cookie store is deliberately persistent, so the provider can remember the
 * user. Aurral sessions run on a fixed 30-day clock with no refresh, and an
 * OIDC user has no stored password for pocket to replay, so without a provider
 * session every expiry would mean typing provider credentials again.
 * `OidcLogoutWebView` ends that provider session at sign-out.
 */
export function OidcSignInModal({
  visible,
  serverUrl,
  onClose,
  onSession,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {/* Mounted only while open, so a cancelled sign-in leaves nothing
          half-built. Provider cookies outlive the view by design. */}
      {visible ? (
        <OidcSignInFlow
          serverUrl={serverUrl}
          onClose={onClose}
          onSession={onSession}
        />
      ) : null}
    </Modal>
  );
}

function OidcSignInFlow({
  serverUrl,
  onClose,
  onSession,
}: Omit<Props, "visible">) {
  const colors = Colors[useColorScheme()];
  const webViewRef = useRef<WebView>(null);
  const [phase, setPhase] = useState<Phase>("authorizing");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const exchangeCode = useRef<string | null>(null);
  const exchangeInjected = useRef(false);

  const startExchange = useCallback((code: string) => {
    exchangeCode.current = code;
    exchangeInjected.current = false;
    setPhase("exchanging");
  }, []);

  /**
   * Takes the outcome out of the completion redirect. Returns true when the URL
   * ended the flow, so the caller can block the navigation and keep the web
   * frontend from spending the single-use code first.
   */
  const consumeCompletion = useCallback(
    (url: string): boolean => {
      if (phase !== "authorizing") return false;
      if (!isOidcCompleteUrl(serverUrl, url)) return false;

      const completion = readOidcCompletion(url);
      if (!completion) {
        setError("The server did not return a sign-in code.");
        return true;
      }
      if (completion.kind === "error") {
        setError(completion.message);
        return true;
      }
      startExchange(completion.code);
      return true;
    },
    [phase, serverUrl, startExchange],
  );

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => !consumeCompletion(request.url),
    [consumeCompletion],
  );

  // Backstop for a platform that skips `onShouldStartLoadWithRequest` on a
  // server-side redirect. The page has loaded by now, so the web frontend may
  // have spent the code: the exchange then fails with a message, not a hang.
  const handleNavigationStateChange = useCallback(
    (navigation: WebViewNavigation) => {
      consumeCompletion(navigation.url);
    },
    [consumeCompletion],
  );

  const handleLoadEnd = useCallback(() => {
    if (phase !== "exchanging") return;
    const code = exchangeCode.current;
    if (!code || exchangeInjected.current) return;
    exchangeInjected.current = true;
    webViewRef.current?.injectJavaScript(buildOidcExchangeScript(code));
  }, [phase]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // Only the Aurral server's own origin may hand this app a session.
      if (!isServerOrigin(serverUrl, event.nativeEvent.url)) return;

      const message = parseOidcMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === "error") {
        setError(message.message);
        return;
      }
      onSession(message.session);
    },
    [serverUrl, onSession],
  );

  const handleRetry = useCallback(() => {
    setPhase("authorizing");
    setError(null);
    exchangeCode.current = null;
    exchangeInjected.current = false;
    setAttempt((value) => value + 1);
  }, []);

  const uri =
    phase === "authorizing"
      ? buildOidcLoginUrl(serverUrl)
      : buildOidcExchangePageUrl(serverUrl);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text variant="body">Sign In</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close sign-in"
          testID="oidc-close"
        >
          <Ionicons name="close" size={24} color={colors.icon} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorPane}>
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={colors.error}
          />
          <Text variant="subtitle" style={styles.errorText}>
            {error}
          </Text>
          <Button title="Try Again" onPress={handleRetry} />
          <Button title="Cancel" variant="inline" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.webViewPane}>
          <WebView
            // `attempt` remounts only on an explicit retry, which is when a
            // fresh transaction is wanted. Phase changes must not remount.
            key={attempt}
            ref={webViewRef}
            source={{ uri }}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["http://*", "https://*"]}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadEnd={handleLoadEnd}
            onMessage={handleMessage}
            onError={() =>
              setError("Unable to reach the sign-in page. Check the server.")
            }
            style={styles.webView}
            testID="oidc-webview"
          />
          {phase === "exchanging" && (
            <View
              style={[styles.overlay, { backgroundColor: colors.background }]}
            >
              <ActivityIndicator
                size="large"
                color={colors.brand}
                testID="oidc-exchanging"
              />
              <Text variant="subtitle" style={styles.overlayText}>
                Completing sign-in
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webViewPane: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  overlayText: {
    marginTop: 4,
  },
  errorPane: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    textAlign: "center",
  },
});
