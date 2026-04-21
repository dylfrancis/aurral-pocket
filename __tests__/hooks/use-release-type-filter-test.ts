import {
  matchesFilter,
  PRIMARY_TYPES,
  SECONDARY_TYPES,
} from "@/hooks/library/use-release-type-filter";
import type { Album } from "@/lib/types/library";

const baseAlbum: Album = {
  id: "1",
  artistId: "1",
  artistName: "Test",
  mbid: "mbid-1",
  foreignAlbumId: "mbid-1",
  albumName: "Test Album",
  title: "Test Album",
  releaseDate: "2024-01-01",
  monitored: true,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 100 },
};

describe("matchesFilter", () => {
  const allSelected = new Set<string>([...PRIMARY_TYPES, ...SECONDARY_TYPES]);

  it("matches when all types are selected", () => {
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: [],
    };
    expect(matchesFilter(album, allSelected)).toBe(true);
  });

  it("matches album with matching primary type", () => {
    const selected = new Set(["Album", ...SECONDARY_TYPES]);
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: [],
    };
    expect(matchesFilter(album, selected)).toBe(true);
  });

  it("rejects album with non-selected primary type", () => {
    const selected = new Set(["EP", "Single", ...SECONDARY_TYPES]);
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: [],
    };
    expect(matchesFilter(album, selected)).toBe(false);
  });

  it("matches EP type", () => {
    const selected = new Set(["EP", ...SECONDARY_TYPES]);
    const album = {
      ...baseAlbum,
      albumType: "EP" as const,
      secondaryTypes: [],
    };
    expect(matchesFilter(album, selected)).toBe(true);
  });

  it("matches Single type", () => {
    const selected = new Set(["Single", ...SECONDARY_TYPES]);
    const album = {
      ...baseAlbum,
      albumType: "Single" as const,
      secondaryTypes: [],
    };
    expect(matchesFilter(album, selected)).toBe(true);
  });

  it("matches album with selected secondary types", () => {
    const selected = new Set(["Album", "Live", ...SECONDARY_TYPES]);
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: ["Live" as const],
    };
    expect(matchesFilter(album, selected)).toBe(true);
  });

  it("rejects album when secondary type is not selected", () => {
    const selected = new Set(["Album", "EP", "Single"]); // no secondary types
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: ["Live" as const],
    };
    expect(matchesFilter(album, selected)).toBe(false);
  });

  it("rejects when one of multiple secondary types is not selected", () => {
    const selected = new Set(["Album", "Live"]); // Compilation not selected
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: ["Live" as const, "Compilation" as const],
    };
    expect(matchesFilter(album, selected)).toBe(false);
  });

  it("matches when all secondary types are selected", () => {
    const selected = new Set(["Album", "Live", "Compilation"]);
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: ["Live" as const, "Compilation" as const],
    };
    expect(matchesFilter(album, selected)).toBe(true);
  });

  it("normalizes unknown secondary types to Other", () => {
    const selected = new Set(["Album", "Other"]);
    const album = {
      ...baseAlbum,
      albumType: "Album" as const,
      secondaryTypes: ["UnknownType" as any],
    };
    expect(matchesFilter(album, selected)).toBe(true);
  });

  it("defaults albumType to Album when undefined", () => {
    const selected = new Set(["Album", ...SECONDARY_TYPES]);
    const album = { ...baseAlbum, albumType: undefined, secondaryTypes: [] };
    expect(matchesFilter(album, selected)).toBe(true);
  });
});
