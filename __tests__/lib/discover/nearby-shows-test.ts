import {
  filterNearbyShows,
  splitShowFeed,
  type NearbyShowsFilters,
} from "@/lib/discover/nearby-shows";
import type { ConcertEvent } from "@/lib/types/search";

// Shows as Aurral 3.0 sends them: one entry per event, every matched artist
// listed, and why each matched.
const shows: ConcertEvent[] = [
  {
    id: "a",
    eventName: "The Record Tour",
    artistNames: ["Boygenius", "Japanese Breakfast"],
    sourceTypes: ["library", "recommended"],
    date: "2026-11-14",
  },
  {
    id: "b",
    eventName: "Alvvays",
    artistNames: ["Alvvays"],
    sourceTypes: ["recommended"],
    date: "2026-11-20",
  },
  {
    id: "c",
    eventName: "Wednesday – Bleeds Tour",
    artistNames: ["Wednesday"],
    sourceTypes: ["trending"],
    date: "2026-12-02",
  },
];

const defaults: NearbyShowsFilters = {
  source: "all",
  dateRange: "all",
  query: "",
};

const visibleIds = (filters: Partial<NearbyShowsFilters>) =>
  filterNearbyShows(shows, { ...defaults, ...filters }).map((show) => show.id);

describe("filterNearbyShows", () => {
  it("matches a search against any artist on the show", () => {
    expect(visibleIds({ query: "japanese" })).toEqual(["a"]);
  });

  it.each([
    ["library", ["a"]],
    // As on the web, Discover holds trending matches as well as recommended.
    ["discover", ["a", "b", "c"]],
  ] as const)("keeps the shows the %s filter takes", (source, ids) => {
    expect(visibleIds({ source })).toEqual(ids);
  });
});

describe("splitShowFeed", () => {
  const now = new Date(2026, 10, 22);
  const onDates = (...dates: (string | null)[]) =>
    dates.map((date, i): ConcertEvent => ({
      id: String(i),
      artistNames: ["Artist"],
      sourceTypes: ["library"],
      date,
    }));

  it("leads with the first show and shelves the next eight", () => {
    const feed = splitShowFeed(
      onDates(...Array.from({ length: 11 }, () => "2026-12-05")),
      now,
    );

    expect(feed.lead.id).toBe("0");
    expect(feed.shelf.map((show) => show.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    expect(feed.groups.flatMap((g) => g.shows.map((s) => s.id))).toEqual([
      "9",
      "10",
    ]);
  });

  it("skips the shelf when fewer than three shows follow the lead", () => {
    const feed = splitShowFeed(onDates("2026-12-01", "2026-12-05"), now);

    expect(feed.shelf).toEqual([]);
    expect(feed.groups).toEqual([
      { label: "December", shows: [expect.objectContaining({ id: "1" })] },
    ]);
  });

  it("heads each month, with the year once it isn't this one's", () => {
    const feed = splitShowFeed(
      onDates(
        "2026-11-28",
        "2026-11-29",
        "2026-12-01",
        "2026-12-02",
        "2026-12-03",
        "2026-12-04",
        "2026-12-05",
        "2026-12-06",
        "2026-12-07",
        // The shelf ends here.
        "2026-12-08",
        "2027-01-09",
        null,
      ),
      now,
    );

    expect(feed.groups.map((group) => group.label)).toEqual([
      "December",
      "January 2027",
      "Date to be announced",
    ]);
  });
});
