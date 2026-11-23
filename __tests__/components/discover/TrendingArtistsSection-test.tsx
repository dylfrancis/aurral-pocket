jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

jest.mock("@/lib/api/search", () => ({
  getTrendingCharts: jest.fn(),
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  lookupLibraryArtists: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrendingArtistsSection } from "@/components/discover/TrendingArtistsSection";
import { getTrendingCharts } from "@/lib/api/search";
import type {
  TrendingArtist,
  TrendingChartsResponse,
} from "@/lib/types/search";

const mockGetCharts = getTrendingCharts as jest.Mock;

const drake: TrendingArtist = {
  key: "r1",
  position: 1,
  name: "Drake",
  imageUrl: "https://images.example/drake.jpg",
  mbid: "9fff2f8a-21e6-47de-a2b8-7f449929d43f",
  fans: 24129526,
};

function charts(artists: TrendingArtist[] | null): TrendingChartsResponse {
  return {
    region: "US",
    updatedAt: null,
    songs: null,
    albums: null,
    genreShare: null,
    artists,
    genres: [],
  };
}

async function renderSection(
  data: TrendingChartsResponse,
  onOpenArtist = jest.fn(),
) {
  mockGetCharts.mockResolvedValue(data);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <TrendingArtistsSection onOpenArtist={onOpenArtist} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TrendingArtistsSection", () => {
  it("shows the artist chart with each rank and opens a matched artist", async () => {
    const onOpenArtist = jest.fn();
    await renderSection(charts([drake]), onOpenArtist);

    expect(await screen.findByText("Trending Artists")).toBeTruthy();
    expect(screen.getByText("No. 1 · 24M fans")).toBeTruthy();

    await fireEvent.press(screen.getByText("Drake"));

    expect(onOpenArtist).toHaveBeenCalledWith(
      expect.objectContaining({ mbid: drake.mbid, name: "Drake" }),
    );
  });

  it("shows nothing until Aurral has loaded the artist chart", async () => {
    await renderSection(charts(null));

    await waitFor(() => expect(screen.toJSON()).toBeNull());
  });
});
