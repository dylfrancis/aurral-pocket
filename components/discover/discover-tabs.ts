export type DiscoverTab = "forYou" | "playlists" | "trending";

export type DiscoverTabsProps = {
  selected: DiscoverTab;
  onSelect: (tab: DiscoverTab) => void;
};

export const DISCOVER_TABS: readonly { id: DiscoverTab; label: string }[] = [
  { id: "forYou", label: "For You" },
  { id: "playlists", label: "Playlists" },
  { id: "trending", label: "Trending" },
];
