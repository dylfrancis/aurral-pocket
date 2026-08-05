jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

const mockReset = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryErrorResetBoundary: () => ({ reset: mockReset }),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { ApiError } from "@/lib/api/client";

const retry = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

function renderBoundary(error: Error, notFoundMessage?: string) {
  return render(
    <RouteErrorBoundary
      error={error}
      retry={retry}
      message="Failed to load artist"
      notFoundMessage={notFoundMessage}
    />,
  );
}

describe("RouteErrorBoundary", () => {
  it("shows the not-found message for a 404 when one is supplied", async () => {
    const { getByText, queryByText } = await renderBoundary(
      new ApiError(404, "Not found"),
      "Artist not found",
    );

    expect(getByText("Artist not found")).toBeTruthy();
    // A 404 is not retryable — the resource is absent, not unreachable.
    expect(queryByText("Try Again")).toBeNull();
  });

  it("falls back to the generic message for a 404 with no notFoundMessage", async () => {
    const { getByText } = await renderBoundary(new ApiError(404, "Not found"));

    expect(getByText("Failed to load artist")).toBeTruthy();
    expect(getByText("Try Again")).toBeTruthy();
  });

  it("offers a retry for non-404 failures", async () => {
    const { getByText } = await renderBoundary(
      new ApiError(500, "Server error"),
      "Artist not found",
    );

    expect(getByText("Failed to load artist")).toBeTruthy();
    expect(getByText("Try Again")).toBeTruthy();
  });

  it("resets the query error state before retrying", async () => {
    const { getByText } = await renderBoundary(new ApiError(500, "boom"));

    await fireEvent.press(getByText("Try Again"));

    // Without the reset, the query stays errored and the remounted screen
    // throws again immediately.
    expect(mockReset).toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();
  });

  it("handles a plain Error that is not an ApiError", async () => {
    const { getByText } = await renderBoundary(
      new Error("network down"),
      "Artist not found",
    );

    expect(getByText("Failed to load artist")).toBeTruthy();
  });
});
