const mockClearAll = jest.fn(() => Promise.resolve());
const mockRequestOidcLogout = jest.fn();
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    clearAll: mockClearAll,
    requestOidcLogout: mockRequestOidcLogout,
  }),
}));

jest.mock("@/lib/api/auth", () => ({
  logout: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/storage", () => ({
  AppStorage: { getOidcLogoutUrl: jest.fn() },
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChangeServer } from "@/hooks/auth/use-change-server";
import { logout } from "@/lib/api/auth";
import { AppStorage } from "@/lib/storage";

const mockLogout = logout as jest.Mock;
const mockGetOidcLogoutUrl = AppStorage.getOidcLogoutUrl as jest.Mock;

async function changeServer() {
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: 0 } },
  });
  client.setQueryData(["me", "listeningHistory"], { lastfm: "ada" });
  const { result } = await renderHook(() => useChangeServer(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await act(() => result.current.mutateAsync());
  return client;
}

beforeEach(() => jest.clearAllMocks());

describe("useChangeServer", () => {
  it("signs out of the server before forgetting it and its cached data", async () => {
    mockGetOidcLogoutUrl.mockResolvedValue(null);

    const client = await changeServer();

    expect(mockLogout).toHaveBeenCalled();
    expect(mockRequestOidcLogout).not.toHaveBeenCalled();
    await waitFor(() => expect(mockClearAll).toHaveBeenCalled());
    expect(client.getQueryData(["me", "listeningHistory"])).toBeUndefined();
  });

  it("ends the provider session of an SSO sign-in", async () => {
    mockGetOidcLogoutUrl.mockResolvedValue("https://sso.example.com/logout");

    await changeServer();

    expect(mockRequestOidcLogout).toHaveBeenCalledWith(
      "https://sso.example.com/logout",
    );
    expect(mockClearAll).toHaveBeenCalled();
  });
});
