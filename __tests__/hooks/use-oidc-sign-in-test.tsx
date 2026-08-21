jest.mock("@/lib/api/health", () => ({
  getServerHealth: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useOidcSignIn } from "@/hooks/auth/use-oidc-sign-in";
import { getServerHealth } from "@/lib/api/health";
import { authKeys } from "@/lib/query-keys";

const mockUseAuth = useAuth as jest.Mock;
const mockGetServerHealth = getServerHealth as jest.Mock;

const SERVER = "https://aurral.example.com";

const SESSION = {
  token: "t0ken",
  expiresAt: 1_700_000_000_000,
  user: { id: 7, username: "ada", role: "user" as const, permissions: {} },
};

let queryClient: QueryClient;
let setAuth: jest.Mock;
let markOidcSession: jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  setAuth = jest.fn().mockResolvedValue(undefined);
  markOidcSession = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ serverUrl: SERVER, setAuth, markOidcSession });
  mockGetServerHealth.mockResolvedValue({
    status: "ok",
    authRequired: true,
    onboardingRequired: false,
    timestamp: "now",
    oidcEnabled: true,
    oidcLogoutUrl: "https://idp.example.com/logout",
  });
});

describe("useOidcSignIn", () => {
  it("stores the session like any other login", async () => {
    const { result } = await renderHook(() => useOidcSignIn(), { wrapper });
    await act(async () => {
      await result.current(SESSION);
    });

    expect(setAuth).toHaveBeenCalledWith(
      "t0ken",
      SESSION.user,
      SESSION.expiresAt,
    );
    expect(queryClient.getQueryData(authKeys.me(SERVER))).toEqual({
      user: SESSION.user,
      expiresAt: SESSION.expiresAt,
    });
  });

  it("records the logout URL the server reports", async () => {
    const { result } = await renderHook(() => useOidcSignIn(), { wrapper });
    await act(async () => {
      await result.current(SESSION);
    });
    expect(markOidcSession).toHaveBeenCalledWith(
      "https://idp.example.com/logout",
    );
  });

  it("records the session as OIDC even when the server reports no logout URL", async () => {
    mockGetServerHealth.mockResolvedValue({
      status: "ok",
      authRequired: true,
      onboardingRequired: false,
      timestamp: "now",
      oidcEnabled: true,
      oidcLogoutUrl: null,
    });
    const { result } = await renderHook(() => useOidcSignIn(), { wrapper });
    await act(async () => {
      await result.current(SESSION);
    });
    expect(markOidcSession).toHaveBeenCalledWith(null);
  });

  it("still signs in when health cannot be read", async () => {
    mockGetServerHealth.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useOidcSignIn(), { wrapper });
    await act(async () => {
      await result.current(SESSION);
    });
    expect(setAuth).toHaveBeenCalled();
    expect(markOidcSession).toHaveBeenCalledWith(null);
  });

  it("reuses a health response the login screen already fetched", async () => {
    queryClient.setQueryData(authKeys.health(SERVER), {
      status: "ok",
      authRequired: true,
      onboardingRequired: false,
      timestamp: "now",
      oidcEnabled: true,
      oidcLogoutUrl: "https://idp.example.com/cached",
    });
    const { result } = await renderHook(() => useOidcSignIn(), { wrapper });
    await act(async () => {
      await result.current(SESSION);
    });
    expect(mockGetServerHealth).not.toHaveBeenCalled();
    expect(markOidcSession).toHaveBeenCalledWith(
      "https://idp.example.com/cached",
    );
  });
});
