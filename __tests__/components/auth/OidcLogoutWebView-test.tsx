jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

let mockWebViewProps: {
  source: { uri: string };
  onLoadEnd: () => void;
  onError: () => void;
} | null = null;

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const WebView = (props: any) => {
    mockWebViewProps = props;
    return React.createElement(View, { testID: props.testID });
  };
  return { __esModule: true, WebView, default: WebView };
});

import React from "react";
import { act, render } from "@testing-library/react-native";
import { OidcLogoutWebView } from "@/components/auth/OidcLogoutWebView";
import { useAuth } from "@/contexts/auth-context";

const mockUseAuth = useAuth as jest.Mock;

let finishOidcLogout: jest.Mock;

function setPending(pendingOidcLogoutUrl: string | null) {
  mockUseAuth.mockReturnValue({ pendingOidcLogoutUrl, finishOidcLogout });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockWebViewProps = null;
  finishOidcLogout = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("OidcLogoutWebView", () => {
  it("renders nothing when no logout is pending", async () => {
    setPending(null);
    const { queryByTestId } = await render(<OidcLogoutWebView />);
    expect(queryByTestId("oidc-logout-webview")).toBeNull();
  });

  it("opens the provider's logout URL when one is pending", async () => {
    setPending("https://idp.example.com/logout");
    const { getByTestId } = await render(<OidcLogoutWebView />);
    expect(getByTestId("oidc-logout-webview")).toBeTruthy();
    expect(mockWebViewProps?.source.uri).toBe("https://idp.example.com/logout");
  });

  it("clears the request once the provider page has loaded", async () => {
    setPending("https://idp.example.com/logout");
    await render(<OidcLogoutWebView />);
    await act(async () => {
      mockWebViewProps?.onLoadEnd();
    });
    expect(finishOidcLogout).toHaveBeenCalledTimes(1);
  });

  it("clears the request when the provider cannot be reached", async () => {
    setPending("https://idp.example.com/logout");
    await render(<OidcLogoutWebView />);
    await act(async () => {
      mockWebViewProps?.onError();
    });
    expect(finishOidcLogout).toHaveBeenCalledTimes(1);
  });

  it("gives up on a provider that never answers", async () => {
    setPending("https://idp.example.com/logout");
    await render(<OidcLogoutWebView />);
    expect(finishOidcLogout).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(finishOidcLogout).toHaveBeenCalledTimes(1);
  });

  it("refuses a URL that is not http, and does not leave it pending", async () => {
    setPending("javascript:alert(1)");
    const { queryByTestId } = await render(<OidcLogoutWebView />);
    expect(queryByTestId("oidc-logout-webview")).toBeNull();
    expect(finishOidcLogout).toHaveBeenCalled();
  });
});
