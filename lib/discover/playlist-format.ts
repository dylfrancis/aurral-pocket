import type { DiscoverPlaylist } from "@/lib/types/search";

const RECIPE_LABELS: {
  key: keyof DiscoverPlaylist["recipe"];
  label: string;
}[] = [
  { key: "discover", label: "Discovery" },
  { key: "mix", label: "Library" },
  { key: "trending", label: "Trending" },
  { key: "focus", label: "Focus" },
  { key: "releaseRadar", label: "New releases" },
];

/** "12 Discovery · 8 Library" from the recipe's non-zero entries. */
export function formatRecipe(recipe: DiscoverPlaylist["recipe"]): string {
  return RECIPE_LABELS.map(({ key, label }) => {
    const count = recipe?.[key] ?? 0;
    return count > 0 ? `${count} ${label}` : null;
  })
    .filter(Boolean)
    .join(" · ");
}

/** Subtitle line: description, else the formatted recipe, else null. */
export function playlistSourceLine(playlist: DiscoverPlaylist): string | null {
  if (playlist.description?.trim()) return playlist.description.trim();
  const recipe = formatRecipe(playlist.recipe);
  return recipe || null;
}
