jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return { ...actual, useMemo: (fn: () => unknown) => fn() };
});

jest.mock("@/lib/api/library", () => ({
  researchAurralAlbum: jest.fn(),
  triggerAlbumSearch: jest.fn(),
  updateLibraryAlbum: jest.fn(),
}));

jest.mock("burnt", () => ({ toast: jest.fn() }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const mockSetQueriesData = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn((config: any) => ({
    config,
    mutate: config.mutationFn,
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    setQueriesData: mockSetQueriesData,
    invalidateQueries: mockInvalidateQueries,
  })),
}));

import { useMutation } from "@tanstack/react-query";
import {
  researchAurralAlbum,
  triggerAlbumSearch,
  updateLibraryAlbum,
} from "@/lib/api/library";
import {
  getEligibleMissingAlbums,
  useResearchMissingAlbums,
} from "@/hooks/library/use-research-missing-albums";
import type { Album } from "@/lib/types/library";

const mockUseMutation = useMutation as jest.Mock;
const mockTriggerAlbumSearch = triggerAlbumSearch as jest.Mock;
const mockUpdateLibraryAlbum = updateLibraryAlbum as jest.Mock;
const mockResearchAurralAlbum = researchAurralAlbum as jest.Mock;

const artist = { mbid: "artist-mb", name: "Artist" };

// Canonical ids are numeric and Lidarr ids here are "a"-prefixed, so a
// Lidarr call that received a canonical id shows up in the assertion.
function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: "900",
    canonicalId: "900",
    lidarrId: "a1",
    artistId: "art1",
    artistName: "Artist",
    mbid: "mb1",
    foreignAlbumId: "f1",
    albumName: "Album",
    title: "Album",
    releaseDate: "2020-01-01",
    monitored: true,
    statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
    ...overrides,
  };
}

function makeAurralAlbum(overrides: Partial<Album> = {}): Album {
  return makeAlbum({ lidarrId: undefined, managedBy: "aurral", ...overrides });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getEligibleMissingAlbums", () => {
  it("returns [] when albums is undefined", () => {
    expect(getEligibleMissingAlbums(undefined, undefined)).toEqual([]);
  });

  it("includes monitored incomplete albums", () => {
    const album = makeAlbum({ monitored: true });
    expect(getEligibleMissingAlbums([album], {})).toEqual([album]);
  });

  it("excludes complete albums (percentOfTracks >= 100)", () => {
    const album = makeAlbum({
      statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 100 },
    });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it("excludes complete albums (sizeOnDisk > 0)", () => {
    const album = makeAlbum({
      statistics: { trackCount: 10, sizeOnDisk: 500, percentOfTracks: 0 },
    });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it("excludes albums Lidarr does not manage", () => {
    const album = makeAlbum({ lidarrId: undefined });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it("excludes albums already downloading", () => {
    const album = makeAlbum();
    expect(
      getEligibleMissingAlbums([album], { a1: { status: "downloading" } }),
    ).toEqual([]);
  });

  it("includes failed albums even if unmonitored", () => {
    const album = makeAlbum({ monitored: false });
    expect(
      getEligibleMissingAlbums([album], { a1: { status: "failed" } }),
    ).toEqual([album]);
  });

  it("excludes unmonitored albums with no failed status", () => {
    const album = makeAlbum({ monitored: false });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it.each([
    ["partial", true, true],
    ["queued", true, false],
    ["unreleased", true, false],
    // Aurral doesn't count an unmonitored album's tracks toward failed.
    ["failed", false, false],
  ])(
    "reads an Aurral album's %p status by its canonical id (monitored %p)",
    (status, monitored, eligible) => {
      const album = makeAurralAlbum({ monitored });
      // A Lidarr album with the canonical id as its id must not decide it.
      const statuses = {
        "900": { status: "failed" as const },
        "aurral:900": { status: status as "partial" },
      };
      expect(getEligibleMissingAlbums([album], statuses)).toEqual(
        eligible ? [album] : [],
      );
    },
  );
});

describe("useResearchMissingAlbums", () => {
  it("reports the count of eligible missing albums", () => {
    const albums = [
      makeAlbum({ monitored: true }),
      makeAlbum({
        id: "901",
        lidarrId: "a2",
        statistics: { trackCount: 10, sizeOnDisk: 1, percentOfTracks: 100 },
      }),
    ];
    const result = useResearchMissingAlbums(albums, {}, artist);
    expect(result.missingCount).toBe(1);
  });

  it("force-monitors unmonitored albums then searches all eligible, by Lidarr id", async () => {
    mockUpdateLibraryAlbum.mockResolvedValue({});
    mockTriggerAlbumSearch.mockResolvedValue({});
    const albums = [
      makeAlbum({ monitored: true }),
      makeAlbum({
        id: "901",
        lidarrId: "a2",
        monitored: false,
        statistics: { trackCount: 1, sizeOnDisk: 0, percentOfTracks: 0 },
      }),
    ];

    useResearchMissingAlbums(albums, { a2: { status: "failed" } }, artist);
    const { config } = mockUseMutation.mock.results[0].value;
    const count = await config.mutationFn();

    expect(mockUpdateLibraryAlbum).toHaveBeenCalledTimes(1);
    expect(mockUpdateLibraryAlbum).toHaveBeenCalledWith("a2", {
      monitored: true,
    });
    expect(mockTriggerAlbumSearch.mock.calls).toEqual([["a1"], ["a2"]]);
    expect(count).toBe(2);
  });

  it("re-searches an Aurral album through Aurral, never Lidarr", async () => {
    mockResearchAurralAlbum.mockResolvedValue(null);
    const album = makeAurralAlbum({ artistName: "" });

    useResearchMissingAlbums(
      [album],
      { "aurral:900": { status: "partial" } },
      artist,
    );
    const { config } = mockUseMutation.mock.results[0].value;
    await config.mutationFn();

    expect(mockResearchAurralAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalId: "900", monitored: true }),
      { mbid: "artist-mb", name: "Artist" },
    );
    expect(mockTriggerAlbumSearch).not.toHaveBeenCalled();
    expect(mockUpdateLibraryAlbum).not.toHaveBeenCalled();
  });

  it("optimistically marks eligible albums as in flight, under each one's status key", () => {
    const albums = [
      makeAlbum({ monitored: true }),
      makeAurralAlbum({ id: "901", canonicalId: "901" }),
    ];
    useResearchMissingAlbums(
      albums,
      { "aurral:901": { status: "cancelled" } },
      artist,
    );
    const { config } = mockUseMutation.mock.results[0].value;

    config.onMutate();
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ["library", "downloadStatuses"] },
      expect.any(Function),
    );
    const updater = mockSetQueriesData.mock.calls[0][1];
    expect(updater({})).toEqual({
      a1: { status: "searching" },
      "aurral:901": { status: "queued" },
    });
  });
});
