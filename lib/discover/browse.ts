import type { EditorialCategory, EditorialGroup } from "@/lib/types/search";

/** In the web's order. */
export const BROWSE_GROUPS: readonly {
  group: EditorialGroup;
  title: string;
}[] = [
  { group: "mood", title: "Moods" },
  { group: "decade", title: "Decades" },
  { group: "genre", title: "Genres" },
];

export function isEditorialGroup(value: unknown): value is EditorialGroup {
  return BROWSE_GROUPS.some((entry) => entry.group === value);
}

export function categoriesInGroup(
  categories: readonly EditorialCategory[],
  group: EditorialGroup,
): EditorialCategory[] {
  return categories.filter(
    (category) => category.group === group && category.playlists.length > 0,
  );
}
