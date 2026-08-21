jest.mock("@/lib/api/auth", () => ({
  logout: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  AppStorage: { getOidcLogoutUrl: jest.fn() },
  SecureStorage: { deleteCredentials: jest.fn() },
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@/hooks/auth/use-logout";
import { logout } from "@/lib/api/auth";
import { AppStorage, SecureStorage } from "@/lib/storage";

const mockUseAuth = useAuth as jest.Mock;
const mockLogout = logout as jest.Mock;
const mockGetOidcLogoutUrl = AppStorage.getOidcLogoutUrl as jest.Mock;

let requestOidcLogout: jest.Mock;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  requestOidcLogout = jest.fn();
  mockUseAuth.mockReturnValue({
    clearAuth: jest.fn().mockResolvedValue(undefined),
    setRememberCredentials: jest.fn().mockResolvedValue(undefined),
    setUseBiometrics: jest.fn().mockResolvedValue(undefined),
    requestOidcLogout,
  });
  mockLogout.mockResolvedValue({});
  mockGetOidcLogoutUrl.mockResolvedValue(null);
  (SecureStorage.deleteCredentials as jest.Mock).mockResolvedValue(undefined);
});

describe("useLogout", () => {
  it("asks for a provider logout when the session came from OIDC", async () => {
    mockGetOidcLogoutUrl.mockResolvedValue("https://idp.example.com/logout");
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() =>
      expect(requestOidcLogout).toHaveBeenCalledWith(
        "https://idp.example.com/logout",
      ),
    );
  });

  it("asks for no provider logout on a password session", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(requestOidcLogout).not.toHaveBeenCalled();
  });

  it("asks for no provider logout when OIDC reported no logout URL", async () => {
    mockGetOidcLogoutUrl.mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(requestOidcLogout).not.toHaveBeenCalled();
  });
});
