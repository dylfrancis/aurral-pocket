import { Ionicons } from "@expo/vector-icons";
import Artist from "@expo/material-symbols/artist.xml";
import CalendarToday from "@expo/material-symbols/calendar_today.xml";
import CloudDownload from "@expo/material-symbols/cloud_download.xml";
import Event from "@expo/material-symbols/event.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";

export type AlbumSortMode =
  "date-desc" | "date-asc" | "name-asc" | "name-desc" | "missing";

/** The whole-library album sorts. The server sorts; see useAlbumGrid. */
export type LibraryAlbumSortMode =
  "name-asc" | "name-desc" | "artist-asc" | "artist-desc" | "newest";

export type SortOption<Key extends string = AlbumSortMode> = {
  key: Key;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iosIcon: string;
  /** The Material Symbol the Android toolbar menu shows. */
  androidIcon: number;
};

// The name sorts read the same on an artist's pages and on the whole library.
const NAME_ASC: SortOption<"name-asc"> = {
  key: "name-asc",
  label: "Name A-Z",
  icon: "text-outline",
  iosIcon: "textformat.abc",
  androidIcon: SortByAlpha,
};

const NAME_DESC: SortOption<"name-desc"> = {
  key: "name-desc",
  label: "Name Z-A",
  icon: "text-outline",
  iosIcon: "textformat.abc",
  androidIcon: SortByAlpha,
};

export const ALBUM_SORT_OPTIONS: SortOption[] = [
  {
    key: "date-desc",
    label: "Newest First",
    icon: "calendar-outline",
    iosIcon: "calendar.badge.clock",
    androidIcon: Event,
  },
  {
    key: "date-asc",
    label: "Oldest First",
    icon: "calendar-outline",
    iosIcon: "calendar",
    androidIcon: CalendarToday,
  },
  NAME_ASC,
  NAME_DESC,
  {
    key: "missing",
    label: "Missing",
    icon: "cloud-download-outline",
    iosIcon: "icloud.and.arrow.down",
    androidIcon: CloudDownload,
  },
];

export const LIBRARY_ALBUM_SORT_OPTIONS: SortOption<LibraryAlbumSortMode>[] = [
  NAME_ASC,
  NAME_DESC,
  {
    key: "artist-asc",
    label: "Artist A-Z",
    icon: "person-outline",
    iosIcon: "music.mic",
    androidIcon: Artist,
  },
  {
    key: "artist-desc",
    label: "Artist Z-A",
    icon: "person-outline",
    iosIcon: "music.mic",
    androidIcon: Artist,
  },
  {
    key: "newest",
    label: "Recently Added",
    icon: "time-outline",
    iosIcon: "clock",
    androidIcon: Schedule,
  },
];
