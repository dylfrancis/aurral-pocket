import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TABS = join(__dirname, "../../app/(app)/(tabs)");

// The artist page opens these by bare path, which Expo Router resolves inside
// the current tab. A tab without one sends the push to another tab's stack.
const ARTIST_PAGE_TARGETS = [
  "artist/albums.tsx",
  "artist/releases.tsx",
  "album/[ref].tsx",
  "release/[mbid].tsx",
];

const groupsWithArtistPage = readdirSync(TABS).filter((group) =>
  existsSync(join(TABS, group, "artist/[mbid].tsx")),
);

it("finds the tabs that show an artist page", () => {
  expect(groupsWithArtistPage.length).toBeGreaterThan(1);
});

it.each(groupsWithArtistPage)(
  "%s has every screen its artist page opens",
  (group) => {
    const missing = ARTIST_PAGE_TARGETS.filter(
      (route) => !existsSync(join(TABS, group, route)),
    );
    expect(missing).toEqual([]);
  },
);
