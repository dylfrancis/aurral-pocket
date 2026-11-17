jest.mock("@/lib/api/search", () => ({
  getMadeForYou: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MadeForYouSection } from "@/components/discover/MadeForYouSection";
import { getMadeForYou } from "@/lib/api/search";
import type { EditorialPlaylistSummary } from "@/lib/types/search";

const mockGetMadeForYou = getMadeForYou as jest.Mock;

function playlistSummary(
  provider: EditorialPlaylistSummary["provider"],
  id: string,
  name: string,
): EditorialPlaylistSummary {
  return {
    provider,
    id,
    name,
    description: null,
    trackCount: 50,
    artworkUrl: `/api/discover/playlists/${provider}/${id}/cover?v=1`,
    curator: "Aurral",
  };
}

const clients: QueryClient[] = [];
const onViewAll = jest.fn();

async function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <MadeForYouSection onViewAll={onViewAll} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("MadeForYouSection", () => {
  it("lists the discovery playlists before the mixes, with a View All", async () => {
    mockGetMadeForYou.mockResolvedValue({
      discovery: [playlistSummary("discovery", "new-to-you", "New to You")],
      mixes: [
        playlistSummary("mix", "daily-1", "Daily Mix 1"),
        playlistSummary("mix", "on-repeat", "On Repeat"),
      ],
    });

    await renderSection();

    expect(
      screen
        .getAllByLabelText(/^Open /)
        .map((node) => node.props.accessibilityLabel),
    ).toEqual(["Open New to You", "Open Daily Mix 1", "Open On Repeat"]);
    await fireEvent.press(screen.getByText("View All"));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it("hides the section while the user has none", async () => {
    mockGetMadeForYou.mockResolvedValue({ discovery: [], mixes: [] });

    await renderSection();

    expect(screen.queryByText("Made for You")).toBeNull();
  });
});
