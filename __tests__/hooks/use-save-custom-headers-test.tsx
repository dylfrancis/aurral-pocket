jest.mock("@/lib/api/health", () => ({
  checkServerLive: jest.fn(),
}));

jest.mock("@/lib/player/player", () => ({
  refreshQueueHeaders: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useSaveCustomHeaders } from "@/hooks/auth/use-save-custom-headers";
import {
  ApiError,
  customHeadersFor,
  setBaseUrl,
  setCustomHeaders,
} from "@/lib/api/client";
import { checkServerLive } from "@/lib/api/health";
import { refreshQueueHeaders } from "@/lib/player/player";

const mockCheckServerLive = checkServerLive as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const SERVER = "https://aurral.example.com";
const SAVED_HEADERS = { "CF-Access-Client-Id": "old.access" };
const NEW_HEADERS = { "CF-Access-Client-Id": "new.access" };

let queryClient: QueryClient;
let saveCustomHeaders: jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // No gc timers, or this file never lets Jest exit.
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  saveCustomHeaders = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    customHeaders: SAVED_HEADERS,
    saveCustomHeaders,
  });
  setBaseUrl(SERVER);
  setCustomHeaders(SAVED_HEADERS);
});

describe("useSaveCustomHeaders", () => {
  it("keeps the headers once the server answers with them", async () => {
    let headersAtCheck: Record<string, string> = {};
    mockCheckServerLive.mockImplementation(async () => {
      headersAtCheck = customHeadersFor(SERVER);
    });

    const { result } = await renderHook(() => useSaveCustomHeaders(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(NEW_HEADERS);
    });

    expect(headersAtCheck).toEqual(NEW_HEADERS);
    expect(saveCustomHeaders).toHaveBeenCalledWith(NEW_HEADERS);
    // Tracks already queued would otherwise stream with the old ones.
    expect(refreshQueueHeaders).toHaveBeenCalled();
  });

  it("goes back to the saved headers when the server refuses the new ones", async () => {
    mockCheckServerLive.mockRejectedValue(new ApiError(403, "Forbidden"));

    const { result } = await renderHook(() => useSaveCustomHeaders(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(NEW_HEADERS).catch(() => {});
    });

    expect(customHeadersFor(SERVER)).toEqual(SAVED_HEADERS);
    expect(saveCustomHeaders).not.toHaveBeenCalled();
    expect(refreshQueueHeaders).not.toHaveBeenCalled();
  });
});
