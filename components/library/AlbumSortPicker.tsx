import { Ionicons } from "@expo/vector-icons";

export type AlbumSortMode =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "missing";

export type SortOption = {
  key: AlbumSortMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iosIcon: string;
};

export const ALBUM_SORT_OPTIONS: SortOption[] = [
  {
    key: "date-desc",
    label: "Newest First",
    icon: "calendar-outline",
    iosIcon: "calendar.badge.clock",
  },
  {
    key: "date-asc",
    label: "Oldest First",
    icon: "calendar-outline",
    iosIcon: "calendar",
  },
  {
    key: "name-asc",
    label: "Name A-Z",
    icon: "text-outline",
    iosIcon: "textformat.abc",
  },
  {
    key: "name-desc",
    label: "Name Z-A",
    icon: "text-outline",
    iosIcon: "textformat.abc",
  },
  {
    key: "missing",
    label: "Missing",
    icon: "cloud-download-outline",
    iosIcon: "icloud.and.arrow.down",
  },
];
