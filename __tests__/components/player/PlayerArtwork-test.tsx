jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) =>
      React.createElement(View, {
        testID: "player-artwork",
        source: props.source,
        onError: props.onError,
      }),
  };
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";

const COVER_PATH = "/api/library/albums/12/cover?v=abc";
const MBID_IMAGE = "https://covers.example/rg-1.jpg";
const shownSource = () => screen.getByTestId("player-artwork").props.source;

beforeEach(() => {
  setBaseUrl("https://music.example");
  setAuthToken("secret");
});

afterEach(() => {
  setAuthToken(null);
});

describe("PlayerArtwork", () => {
  it("loads the server cover with the token in a header, not the URL", async () => {
    await render(
      <PlayerArtwork url={MBID_IMAGE} coverPath={COVER_PATH} size={40} />,
    );

    expect(shownSource()).toEqual({
      uri: "https://music.example/api/library/albums/12/cover?v=abc",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("falls back to the MBID image when the server has no cover", async () => {
    await render(
      <PlayerArtwork url={MBID_IMAGE} coverPath={COVER_PATH} size={40} />,
    );

    await fireEvent(screen.getByTestId("player-artwork"), "error");

    expect(shownSource()).toEqual({ uri: MBID_IMAGE });
  });

  it("shows the placeholder when the server has no cover and there is no image", async () => {
    await render(<PlayerArtwork url={null} coverPath={COVER_PATH} size={40} />);

    await fireEvent(screen.getByTestId("player-artwork"), "error");

    expect(screen.queryByTestId("player-artwork")).toBeNull();
  });
});
