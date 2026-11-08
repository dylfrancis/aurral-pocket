import type {
  Album,
  PrimaryReleaseType,
  ReleaseGroup,
  SecondaryReleaseType,
} from "@/lib/types/library";

/** An artist page's release rows. Filters and orders follow the web's. */
export const RELEASE_SECTIONS: { type: PrimaryReleaseType; label: string }[] = [
  { type: "Album", label: "Albums" },
  { type: "EP", label: "EPs" },
  { type: "Single", label: "Singles" },
  { type: "Compilation", label: "Compilations" },
  { type: "Broadcast", label: "Broadcasts" },
  { type: "Other", label: "Other" },
];

const POPULAR_KIND_ORDER = ["Album", "EP", "Single"];

const isCompilation = (
  primary: PrimaryReleaseType,
  secondary: SecondaryReleaseType[],
) => primary === "Compilation" || secondary.includes("Compilation");

const compareDates = (a: ReleaseGroup, b: ReleaseGroup) =>
  (a["first-release-date"] ?? "").localeCompare(b["first-release-date"] ?? "");

function popularKindRank(rg: ReleaseGroup) {
  if (rg["secondary-types"].length > 0) return POPULAR_KIND_ORDER.length;
  const rank = POPULAR_KIND_ORDER.indexOf(rg["primary-type"]);
  return rank === -1 ? POPULAR_KIND_ORDER.length : rank;
}

export function comparePopularReleases(a: ReleaseGroup, b: ReleaseGroup) {
  return (
    (b.listenerCount ?? 0) - (a.listenerCount ?? 0) ||
    popularKindRank(a) - popularKindRank(b) ||
    compareDates(b, a)
  );
}

export function matchesReleaseSection(
  rg: ReleaseGroup,
  section: PrimaryReleaseType,
) {
  const compilation = isCompilation(rg["primary-type"], rg["secondary-types"]);
  if (section === "Compilation") return compilation;
  return !compilation && rg["primary-type"] === section;
}

export function librarySection(album: Album): PrimaryReleaseType {
  const primary = album.albumType ?? "Album";
  return isCompilation(primary, album.secondaryTypes ?? [])
    ? "Compilation"
    : primary;
}

export function groupReleasesBySection(releaseGroups: ReleaseGroup[]) {
  const grouped = new Map<PrimaryReleaseType, ReleaseGroup[]>();
  for (const { type } of RELEASE_SECTIONS) {
    const releases = releaseGroups
      .filter((rg) => matchesReleaseSection(rg, type))
      .sort((a, b) => compareDates(b, a));
    if (releases.length > 0) grouped.set(type, releases);
  }
  return grouped;
}
