import {
  comparePopularReleases,
  groupReleasesBySection,
  librarySection,
} from "@/lib/release-groups";
import type {
  Album,
  PrimaryReleaseType,
  ReleaseGroup,
  SecondaryReleaseType,
} from "@/lib/types/library";

function release(
  title: string,
  primary: PrimaryReleaseType,
  date: string | null,
  {
    secondary = [],
    listeners,
  }: { secondary?: SecondaryReleaseType[]; listeners?: number } = {},
): ReleaseGroup {
  return {
    id: title,
    title,
    "first-release-date": date,
    "primary-type": primary,
    "secondary-types": secondary,
    ...(listeners === undefined ? {} : { listenerCount: listeners }),
  };
}

const titles = (releases: ReleaseGroup[] = []) =>
  releases.map((rg) => rg.title);

const RELEASES = [
  release("Studio", "Album", "2020-05-01", { listeners: 500 }),
  release("Classic", "Album", "1997-05-21", { listeners: 900 }),
  release("Hits", "Album", "2008-01-01", {
    secondary: ["Compilation"],
    listeners: 800,
  }),
  release("Box Set", "Compilation", "2012-01-01"),
  release("Concert", "Album", "2006-06-01", {
    secondary: ["Live"],
    listeners: 100,
  }),
  release("Early EP", "EP", "2001-03-01", { listeners: 500 }),
  release("Lead Single", "Single", "2022-09-01"),
  release("B-Sides", "Single", "2010-01-01", { secondary: ["Compilation"] }),
  release("Radio Show", "Broadcast", "2015-01-01"),
  release("Oddity", "Other", null),
];

describe("groupReleasesBySection", () => {
  it.each<[PrimaryReleaseType, string[]]>([
    ["Album", ["Studio", "Concert", "Classic"]],
    ["EP", ["Early EP"]],
    ["Single", ["Lead Single"]],
    ["Compilation", ["Box Set", "B-Sides", "Hits"]],
    ["Broadcast", ["Radio Show"]],
    ["Other", ["Oddity"]],
  ])("lists the %s row's releases in order", (section, expected) => {
    expect(titles(groupReleasesBySection(RELEASES).get(section))).toEqual(
      expected,
    );
  });

  it("leaves out a section with no releases", () => {
    const grouped = groupReleasesBySection([RELEASES[0]]);

    expect([...grouped.keys()]).toEqual(["Album"]);
  });
});

describe("comparePopularReleases", () => {
  it("puts the most listeners first, with no listener count as 0", () => {
    expect(titles([...RELEASES].sort(comparePopularReleases))).toEqual([
      "Classic",
      "Hits",
      "Studio",
      "Early EP",
      "Concert",
      "Lead Single",
      "Radio Show",
      "Box Set",
      "B-Sides",
      "Oddity",
    ]);
  });

  it("breaks a listener tie by kind before date, and only then newest first", () => {
    const tied = [
      release("Remix Album", "Album", "2024-01-01", {
        secondary: ["Remix"],
        listeners: 10,
      }),
      release("Single", "Single", "2023-01-01", { listeners: 10 }),
      release("EP", "EP", "2022-01-01", { listeners: 10 }),
      release("Old Album", "Album", "2020-01-01", { listeners: 10 }),
      release("New Album", "Album", "2021-01-01", { listeners: 10 }),
    ];

    expect(titles(tied.sort(comparePopularReleases))).toEqual([
      "New Album",
      "Old Album",
      "EP",
      "Single",
      "Remix Album",
    ]);
  });
});

describe("librarySection", () => {
  it.each<
    [string, Pick<Album, "albumType" | "secondaryTypes">, PrimaryReleaseType]
  >([
    ["a plain album", { albumType: "Album", secondaryTypes: [] }, "Album"],
    ["a plain EP", { albumType: "EP", secondaryTypes: [] }, "EP"],
    ["an album with no types yet", {}, "Album"],
    [
      "an album that is also a compilation",
      { albumType: "Album", secondaryTypes: ["Compilation"] },
      "Compilation",
    ],
    [
      "an EP that is also a compilation",
      { albumType: "EP", secondaryTypes: ["Compilation"] },
      "Compilation",
    ],
    [
      "a compilation by primary type",
      { albumType: "Compilation", secondaryTypes: [] },
      "Compilation",
    ],
    ["a live album", { albumType: "Album", secondaryTypes: ["Live"] }, "Album"],
  ])("places %s", (_, types, expected) => {
    expect(librarySection(types as Album)).toBe(expected);
  });
});
