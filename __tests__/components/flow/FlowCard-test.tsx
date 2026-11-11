jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ token: "secret" }),
}));

jest.mock("@/components/flow/FlowArtwork", () => ({
  FlowArtwork: () => null,
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) =>
      React.createElement(View, {
        testID: "flow-cover",
        accessibilityLabel: props.source?.uri,
        style: props.style,
        onLoad: props.onLoad,
        onError: props.onError,
      }),
  };
});

import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FlowCard } from "@/components/flow/FlowCard";
import { setBaseUrl } from "@/lib/api/client";
import type { Flow } from "@/lib/types/flow";

const flow: Flow = {
  id: "flow-1",
  name: "Weekly",
  enabled: true,
  size: 30,
  mix: { discover: 100, mix: 0, trending: 0, focus: 0, newReleases: 0 },
  deepDive: false,
  recentListening: false,
  tags: [],
  excludeTags: [],
  relatedArtists: [],
  scheduleDays: [],
  scheduleTime: "08:00",
  autoDownload: true,
  nextRunAt: null,
};

const card = (artworkRevision: number, done = 0) => (
  <FlowCard
    flow={{ ...flow, artworkRevision }}
    stats={{ total: 30, pending: 30 - done, downloading: 0, done, failed: 0 }}
    onPress={jest.fn()}
    onToggleEnabled={jest.fn()}
  />
);

const coverOpacity = () =>
  StyleSheet.flatten(screen.getByTestId("flow-cover").props.style).opacity;

beforeEach(() => {
  setBaseUrl("https://music.example");
});

describe("FlowCard", () => {
  it("loads the cover for the new artwork revision, even after the last one failed", async () => {
    const { rerender } = await render(card(1));
    expect(screen.getByTestId("flow-cover").props.accessibilityLabel).toBe(
      "https://music.example/api/playlists/artwork/flow-1?v=1",
    );

    // The cover was removed, so the server answers 404.
    await fireEvent(screen.getByTestId("flow-cover"), "error");
    expect(screen.queryByTestId("flow-cover")).toBeNull();

    await rerender(card(2));
    expect(screen.getByTestId("flow-cover").props.accessibilityLabel).toBe(
      "https://music.example/api/playlists/artwork/flow-1?v=2",
    );
  });

  it("keeps a loaded cover showing when polling brings new stats", async () => {
    const { rerender } = await render(card(1, 3));
    await fireEvent(screen.getByTestId("flow-cover"), "load");
    expect(coverOpacity()).toBe(1);

    await rerender(card(1, 4));
    expect(coverOpacity()).toBe(1);
  });
});
