jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

type WebViewProps = {
  source: { uri: string; headers?: Record<string, string> };
  onShouldStartLoadWithRequest: (request: { url: string }) => boolean;
  onNavigationStateChange: (navigation: { url: string }) => void;
  onLoadEnd: (event: { nativeEvent: { url: string } }) => void;
  onMessage: (event: { nativeEvent: { url: string; data: string } }) => void;
  onError: () => void;
};

let mockWebViewProps: WebViewProps | null = null;
const mockInjectJavaScript = jest.fn();

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");

  const WebView = React.forwardRef(function WebView(props: any, ref: any) {
    mockWebViewProps = props;
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
    }));
    return React.createElement(View, { testID: props.testID });
  });

  return { __esModule: true, WebView, default: WebView };
});

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { OidcSignInModal } from "@/components/auth/OidcSignInModal";
import { setBaseUrl, setCustomHeaders } from "@/lib/api/client";

const SERVER = "https://aurral.example.com";
const COMPLETE = `${SERVER}/sso/complete#code=code-123`;
const EXCHANGE_PAGE_LOAD = { nativeEvent: { url: `${SERVER}/sso/complete` } };

const SESSION = {
  token: "t0ken",
  expiresAt: 1_700_000_000_000,
  user: { id: 7, username: "ada", role: "user", permissions: {} },
};

async function renderModal(
  overrides: Partial<React.ComponentProps<typeof OidcSignInModal>> = {},
) {
  const onSession = jest.fn();
  const onClose = jest.fn();
  const onAccountSuspended = jest.fn();
  const utils = await render(
    <OidcSignInModal
      visible
      serverUrl={SERVER}
      onClose={onClose}
      onSession={onSession}
      onAccountSuspended={onAccountSuspended}
      {...overrides}
    />,
  );
  return { ...utils, onSession, onClose, onAccountSuspended };
}

beforeEach(() => {
  mockWebViewProps = null;
  mockInjectJavaScript.mockClear();
});

describe("OidcSignInModal", () => {
  it("opens the server's OIDC login route", async () => {
    await renderModal();
    expect(mockWebViewProps?.source.uri).toBe(`${SERVER}/api/auth/oidc/login`);
  });

  it("renders nothing while closed, so no provider session is held open", async () => {
    await renderModal({ visible: false });
    expect(mockWebViewProps).toBeNull();
  });

  it("blocks the completion redirect and moves to the exchange", async () => {
    await renderModal();

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = mockWebViewProps?.onShouldStartLoadWithRequest({
        url: COMPLETE,
      });
    });

    // Blocking the load is what stops the web frontend from spending the
    // single-use code before pocket can.
    expect(allowed).toBe(false);
    expect(mockWebViewProps?.source.uri).toBe(`${SERVER}/sso/complete`);
  });

  it("runs the exchange in the page once the exchange page loads", async () => {
    await renderModal();
    await act(async () => {
      mockWebViewProps?.onShouldStartLoadWithRequest({ url: COMPLETE });
    });
    await act(async () => {
      mockWebViewProps?.onLoadEnd(EXCHANGE_PAGE_LOAD);
    });

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    const script = mockInjectJavaScript.mock.calls[0][0] as string;
    expect(script).toContain("/api/auth/oidc/exchange");
    expect(script).toContain("code-123");
  });

  describe("behind a proxy that wants custom headers", () => {
    const PROXY = { "CF-Access-Client-Secret": "s3cr3t" };

    beforeEach(() => {
      setBaseUrl(SERVER);
      setCustomHeaders(PROXY);
    });

    afterEach(() => {
      setBaseUrl("");
      setCustomHeaders({});
    });

    it("sends them to the server's sign-in page and with the exchange", async () => {
      await renderModal();
      expect(mockWebViewProps?.source).toEqual({
        uri: `${SERVER}/api/auth/oidc/login`,
        headers: PROXY,
      });

      await act(async () => {
        mockWebViewProps?.onShouldStartLoadWithRequest({ url: COMPLETE });
      });
      await act(async () => {
        mockWebViewProps?.onLoadEnd(EXCHANGE_PAGE_LOAD);
      });

      expect(mockInjectJavaScript.mock.calls[0][0]).toContain('"s3cr3t"');
    });

    it("carries them across the provider's redirect back to the server", async () => {
      await renderModal();
      const callback = `${SERVER}/sso/callback?code=abc&state=xyz`;
      const navigate = (url: string) =>
        mockWebViewProps?.onShouldStartLoadWithRequest({ url });

      let allowed: boolean | undefined;
      await act(async () => {
        allowed = navigate("https://idp.example.com/authorize");
      });
      expect(allowed).toBe(true);

      // Sent as the page sends it, the proxy would refuse it.
      await act(async () => {
        allowed = navigate(callback);
      });
      expect(allowed).toBe(false);
      expect(mockWebViewProps?.source).toEqual({
        uri: callback,
        headers: PROXY,
      });

      await act(async () => {
        allowed = navigate(callback);
      });
      expect(allowed).toBe(true);
    });

    it("keeps them out of a page that ended up on another host", async () => {
      await renderModal();
      await act(async () => {
        mockWebViewProps?.onShouldStartLoadWithRequest({ url: COMPLETE });
      });
      await act(async () => {
        mockWebViewProps?.onLoadEnd({
          nativeEvent: { url: "https://idp.example.com/login" },
        });
      });

      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
      expect(mockInjectJavaScript.mock.calls[0][0]).not.toContain("s3cr3t");
    });
  });

  it("does not run the exchange twice when the page reports two loads", async () => {
    await renderModal();
    await act(async () => {
      mockWebViewProps?.onShouldStartLoadWithRequest({ url: COMPLETE });
    });
    await act(async () => {
      mockWebViewProps?.onLoadEnd(EXCHANGE_PAGE_LOAD);
      mockWebViewProps?.onLoadEnd(EXCHANGE_PAGE_LOAD);
    });
    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
  });

  it("does not run the exchange while still authorizing", async () => {
    await renderModal();
    await act(async () => {
      mockWebViewProps?.onLoadEnd(EXCHANGE_PAGE_LOAD);
    });
    expect(mockInjectJavaScript).not.toHaveBeenCalled();
  });

  it("reports the session the page sends back", async () => {
    const { onSession } = await renderModal();
    await act(async () => {
      mockWebViewProps?.onMessage({
        nativeEvent: {
          url: `${SERVER}/sso/complete`,
          data: JSON.stringify({ type: "session", session: SESSION }),
        },
      });
    });
    expect(onSession).toHaveBeenCalledWith(SESSION);
  });

  it("ignores a session offered by any other origin", async () => {
    const { onSession } = await renderModal();
    await act(async () => {
      mockWebViewProps?.onMessage({
        nativeEvent: {
          url: "https://idp.example.com/authorize",
          data: JSON.stringify({ type: "session", session: SESSION }),
        },
      });
    });
    expect(onSession).not.toHaveBeenCalled();
  });

  it("ignores a message that does not carry a usable session", async () => {
    const { onSession } = await renderModal();
    await act(async () => {
      mockWebViewProps?.onMessage({
        nativeEvent: {
          url: `${SERVER}/sso/complete`,
          data: JSON.stringify({ type: "session", session: { token: "" } }),
        },
      });
    });
    expect(onSession).not.toHaveBeenCalled();
  });

  it("shows the error the server put in the redirect", async () => {
    const { getByText } = await renderModal();
    await act(async () => {
      mockWebViewProps?.onShouldStartLoadWithRequest({
        url: `${SERVER}/sso/complete#error=OIDC%20login%20session%20expired`,
      });
    });
    expect(getByText("OIDC login session expired")).toBeTruthy();
    expect(getByText("Try Again")).toBeTruthy();
  });

  it("shows the error the page reported from the exchange", async () => {
    const { getByText } = await renderModal();
    await act(async () => {
      mockWebViewProps?.onMessage({
        nativeEvent: {
          url: `${SERVER}/sso/complete`,
          data: JSON.stringify({ type: "error", message: "Exchange failed" }),
        },
      });
    });
    expect(getByText("Exchange failed")).toBeTruthy();
  });

  it.each([
    [
      "the redirect",
      () =>
        mockWebViewProps?.onShouldStartLoadWithRequest({
          url: `${SERVER}/sso/complete#error=This%20account%20has%20been%20suspended%20or%20disabled`,
        }),
    ],
    [
      "the exchange",
      () =>
        mockWebViewProps?.onMessage({
          nativeEvent: {
            url: `${SERVER}/sso/complete`,
            data: JSON.stringify({
              type: "error",
              message: "This account has been suspended or disabled",
            }),
          },
        }),
    ],
  ])("offers no retry to a suspended account, from %s", async (_, refuse) => {
    const { getByText, queryByText, onAccountSuspended, onClose } =
      await renderModal();

    await act(async () => {
      refuse();
    });

    expect(onAccountSuspended).toHaveBeenCalledTimes(1);
    expect(
      getByText("This account has been suspended or disabled"),
    ).toBeTruthy();
    // The provider remembers the user, so a retry lands on the same refusal.
    expect(queryByText("Try Again")).toBeNull();
    await fireEvent.press(getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not read any other sign-in failure as a suspension", async () => {
    const { onAccountSuspended } = await renderModal();

    await act(async () => {
      mockWebViewProps?.onShouldStartLoadWithRequest({
        url: `${SERVER}/sso/complete#error=OIDC%20login%20failed`,
      });
    });

    expect(onAccountSuspended).not.toHaveBeenCalled();
  });

  it("starts a fresh transaction on retry", async () => {
    const { getByText } = await renderModal();
    await act(async () => {
      mockWebViewProps?.onShouldStartLoadWithRequest({
        url: `${SERVER}/sso/complete#error=nope`,
      });
    });
    await act(async () => {
      getByText("Try Again").props.onPress?.({});
    });
    expect(mockWebViewProps?.source.uri).toBe(`${SERVER}/api/auth/oidc/login`);
  });

  it("catches the completion from a redirect the platform did not offer to block", async () => {
    await renderModal();
    await act(async () => {
      mockWebViewProps?.onNavigationStateChange({ url: COMPLETE });
    });
    expect(mockWebViewProps?.source.uri).toBe(`${SERVER}/sso/complete`);
  });
});
