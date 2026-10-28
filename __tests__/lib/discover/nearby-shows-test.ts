jest.mock("@/lib/api/client", () => ({
  api: { get: jest.fn() },
}));

import { api } from "@/lib/api/client";
import { getNearbyShows } from "@/lib/api/search";
import {
  filterNearbyShows,
  type NearbyShowsFilters,
} from "@/lib/discover/nearby-shows";

const mockGet = api.get as jest.Mock;

// Shows as Aurral 2.12.0 sends them: one entry per event, every matched
// artist listed, no `artistName` or `sourceType`.
const shows212 = [
  {
    id: "a",
    eventName: "The Record Tour",
    artistNames: ["Boygenius", "Japanese Breakfast"],
    sourceTypes: ["library", "recommended"],
    dateTime: "2026-11-14T01:00:00Z",
    distance: 3,
  },
  {
    id: "b",
    eventName: "Alvvays",
    artistNames: ["Alvvays"],
    sourceTypes: ["recommended"],
    dateTime: "2026-11-20T01:00:00Z",
    distance: 8,
  },
  {
    id: "c",
    eventName: "Wednesday – Bleeds Tour",
    artistNames: ["Wednesday"],
    sourceTypes: ["trending"],
    dateTime: "2026-11-02T01:00:00Z",
    distance: 12,
  },
];

const defaults: NearbyShowsFilters = {
  source: "all",
  dateRange: "all",
  query: "",
  sort: "date",
};

async function visibleIds(filters: Partial<NearbyShowsFilters>) {
  mockGet.mockResolvedValue({
    data: { configured: true, location: null, shows: shows212 },
  });
  const { shows } = await getNearbyShows();
  return filterNearbyShows(shows, { ...defaults, ...filters }).map(
    (show) => show.id,
  );
}

describe("filterNearbyShows on a 2.12.0 response", () => {
  it("matches a search against any artist on the show", async () => {
    expect(await visibleIds({ query: "japanese" })).toEqual(["a"]);
  });

  it("sorts by artist using each show's first artist", async () => {
    expect(await visibleIds({ sort: "artist" })).toEqual(["b", "a", "c"]);
  });

  it.each([
    ["library", ["a"]],
    ["recommended", ["a", "b"]],
  ] as const)(
    "keeps every show that matched a %s artist",
    async (source, ids) => {
      expect(await visibleIds({ source })).toEqual(ids);
    },
  );
});
