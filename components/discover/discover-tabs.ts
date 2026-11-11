export type DiscoverTab = "forYou" | "recommended" | "playlists" | "trending";

export type DiscoverTabsProps = {
  selected: DiscoverTab;
  onSelect: (tab: DiscoverTab) => void;
};

export const DISCOVER_TABS: readonly { id: DiscoverTab; label: string }[] = [
  { id: "forYou", label: "For You" },
  { id: "recommended", label: "Recommended" },
  { id: "playlists", label: "Playlists" },
  { id: "trending", label: "Trending" },
];
