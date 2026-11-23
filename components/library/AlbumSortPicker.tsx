import { Ionicons } from "@expo/vector-icons";
import Album from "@expo/material-symbols/album.xml";
import Artist from "@expo/material-symbols/artist.xml";
import BarChart from "@expo/material-symbols/bar_chart.xml";
import CalendarToday from "@expo/material-symbols/calendar_today.xml";
import CloudDownload from "@expo/material-symbols/cloud_download.xml";
import Event from "@expo/material-symbols/event.xml";
import Favorite from "@expo/material-symbols/favorite.xml";
import Group from "@expo/material-symbols/group.xml";
import History from "@expo/material-symbols/history.xml";
import LibraryMusic from "@expo/material-symbols/library_music.xml";
import MusicNote from "@expo/material-symbols/music_note.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import Shuffle from "@expo/material-symbols/shuffle.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";
import TrendingDown from "@expo/material-symbols/trending_down.xml";
import TrendingUp from "@expo/material-symbols/trending_up.xml";

export type AlbumSortMode =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "missing"
  | "popularity-desc"
  | "popularity-asc";

/** Orders only the server can make. */
type ServerOnlySortMode = "played" | "plays" | "released" | "favorited";

/** Sorts for the whole-library album grid, done by the server. */
export type LibraryAlbumSortMode =
  | "name-asc"
  | "name-desc"
  | "artist-asc"
  | "artist-desc"
  | "newest"
  | "random"
  | ServerOnlySortMode;

const SAVED_ALBUM_SORTS = [
  "name-asc",
  "name-desc",
  "artist-asc",
  "artist-desc",
  "newest",
] as const satisfies readonly LibraryAlbumSortMode[];

/** Sorts for saved albums, done on the phone with no plays or favorites. */
export type SavedAlbumSortMode = (typeof SAVED_ALBUM_SORTS)[number];

/** Sorts for the songs list, done by the server, which can't shuffle songs. */
export type LibrarySongSortMode = Exclude<LibraryAlbumSortMode, "random">;

/**
 * Sorts for the artist list. Alphabetical, Recently Added, Album Count and
 * Random are done on the phone over the whole list; the server can't shuffle
 * artists.
 */
export type LibraryArtistSortMode =
  "alpha" | "recent" | "albums" | "random" | ServerOnlySortMode;

/** Sorts for the genres list, done on the phone. */
export type GenreSortMode =
  "name-asc" | "name-desc" | "most-tracks" | "most-albums" | "most-artists";

export type SortOption<Key extends string = AlbumSortMode> = {
  key: Key;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iosIcon: string;
  /** The Material Symbol the Android toolbar menu shows. */
  androidIcon: number;
};

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

export const RELEASE_SORT_OPTIONS: SortOption[] = [
  ...ALBUM_SORT_OPTIONS.filter((option) => option.key !== "missing"),
  {
    key: "popularity-desc",
    label: "Most Popular",
    icon: "trending-up-outline",
    iosIcon: "chart.line.uptrend.xyaxis",
    androidIcon: TrendingUp,
  },
  {
    key: "popularity-asc",
    label: "Least Popular",
    icon: "trending-down-outline",
    iosIcon: "chart.line.downtrend.xyaxis",
    androidIcon: TrendingDown,
  },
];

const RECENTLY_ADDED = {
  label: "Recently Added",
  icon: "time-outline",
  iosIcon: "clock",
  androidIcon: Schedule,
} as const;

const RECENTLY_PLAYED: SortOption<"played"> = {
  key: "played",
  label: "Recently Played",
  icon: "play-circle-outline",
  iosIcon: "clock.arrow.circlepath",
  androidIcon: History,
};

const MOST_PLAYED: SortOption<"plays"> = {
  key: "plays",
  label: "Most Played",
  icon: "bar-chart-outline",
  iosIcon: "chart.bar",
  androidIcon: BarChart,
};

const NEWEST_RELEASE: SortOption<"released"> = {
  key: "released",
  label: "Newest Release",
  icon: "calendar-outline",
  iosIcon: "calendar.badge.clock",
  androidIcon: Event,
};

const RANDOM: SortOption<"random"> = {
  key: "random",
  label: "Random",
  icon: "shuffle-outline",
  iosIcon: "shuffle",
  androidIcon: Shuffle,
};

/** Offered only while a list shows favorites: the server needs `favorite`. */
const RECENTLY_FAVORITED: SortOption<"favorited"> = {
  key: "favorited",
  label: "Recently Favorited",
  icon: "heart-outline",
  iosIcon: "heart",
  androidIcon: Favorite,
};

const BY_ARTIST: SortOption<"artist-asc" | "artist-desc">[] = [
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
];

export const LIBRARY_ALBUM_SORT_OPTIONS: SortOption<LibraryAlbumSortMode>[] = [
  NAME_ASC,
  NAME_DESC,
  ...BY_ARTIST,
  { key: "newest", ...RECENTLY_ADDED },
  RECENTLY_PLAYED,
  MOST_PLAYED,
  NEWEST_RELEASE,
  RANDOM,
  RECENTLY_FAVORITED,
];

export const LIBRARY_SONG_SORT_OPTIONS = LIBRARY_ALBUM_SORT_OPTIONS.filter(
  (option): option is SortOption<LibrarySongSortMode> => option !== RANDOM,
);

/** The Favorites screen's sorts, newest favorite first as on the web. */
export const FAVORITE_SORT_OPTIONS: SortOption<LibrarySongSortMode>[] = [
  RECENTLY_FAVORITED,
  ...LIBRARY_SONG_SORT_OPTIONS.filter(
    (option) => option !== RECENTLY_FAVORITED,
  ),
];

/** The album sorts the phone can do over saved albums. */
export const SAVED_ALBUM_SORT_OPTIONS = LIBRARY_ALBUM_SORT_OPTIONS.filter(
  (option): option is SortOption<SavedAlbumSortMode> =>
    (SAVED_ALBUM_SORTS as readonly string[]).includes(option.key),
);

export const LIBRARY_ARTIST_SORT_OPTIONS: SortOption<LibraryArtistSortMode>[] =
  [
    {
      key: "alpha",
      label: "Alphabetical",
      icon: "text-outline",
      iosIcon: "textformat.abc",
      androidIcon: SortByAlpha,
    },
    { key: "recent", ...RECENTLY_ADDED },
    {
      key: "albums",
      label: "Album Count",
      icon: "albums-outline",
      iosIcon: "square.stack",
      androidIcon: LibraryMusic,
    },
    RECENTLY_PLAYED,
    MOST_PLAYED,
    NEWEST_RELEASE,
    RANDOM,
    RECENTLY_FAVORITED,
  ];

export const GENRE_SORT_OPTIONS: SortOption<GenreSortMode>[] = [
  NAME_ASC,
  NAME_DESC,
  {
    key: "most-tracks",
    label: "Most Tracks",
    icon: "musical-notes-outline",
    iosIcon: "music.note",
    androidIcon: MusicNote,
  },
  {
    key: "most-albums",
    label: "Most Albums",
    icon: "disc-outline",
    iosIcon: "square.stack",
    androidIcon: Album,
  },
  {
    key: "most-artists",
    label: "Most Artists",
    icon: "people-outline",
    iosIcon: "person.2",
    androidIcon: Group,
  },
];
