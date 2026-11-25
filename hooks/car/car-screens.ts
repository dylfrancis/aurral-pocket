import {
  AndroidAutoMediaLibraryHelper,
  CarPlayHelper,
  type CarPlayListItem,
  type CarPlayListSection,
  type CarPlayListTemplate,
  type MediaItem,
} from "react-native-nitro-player";
import {
  CAR_LISTS,
  forgetCarLists,
  loadCarList,
  onCarListGrew,
  searchCar,
  type CarListGrowth,
  type CarList,
  type CarRow,
} from "@/hooks/car/car-library";
import Constants from "expo-constants";
import { headlessSession, onSessionChanged } from "@/lib/headless-session";
import {
  preparePlayer,
  restoreSavedQueue,
  shelveForCar,
} from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";

/**
 * Draws pocket's lists in CarPlay and Android Auto through the audio engine.
 * Call it from the app's entry: a car can open the app with no screen.
 */
export function registerCar(): void {
  const carPlay = CarPlayHelper.isAvailable();
  const androidAuto = AndroidAutoMediaLibraryHelper.isAvailable();
  if (carPlay) registerCarPlay();
  if (androidAuto) registerAndroidAuto();
  // Covers carry the session's token, so even a renewal reads lists again.
  if (carPlay || androidAuto) {
    onSessionChanged((change) => refreshCar(change !== "renewed"));
    onCarListGrew(showGrowth);
  }
}

/**
 * Show rows that landed after a list opened. CarPlay redraws the list and its
 * letters on screen. Android Auto rereads every open folder, so it waits for
 * the last rows.
 */
function showGrowth({ listId, finished, promisedMore }: CarListGrowth): void {
  if (CarPlayHelper.isAvailable()) {
    for (const templateId of [...shownLists.keys()]) {
      if (templateId !== listId && !templateId.startsWith(`${listId}:`)) {
        continue;
      }
      void loadCarList(templateId)
        .then((list) => CarPlayHelper.update(carPlayTemplate(templateId, list)))
        .catch(() => {});
    }
  }
  if (AndroidAutoMediaLibraryHelper.isAvailable() && finished && promisedMore) {
    setAndroidAutoRoot();
  }
}

/**
 * Read every list the car shows again. From the top, CarPlay goes back to its
 * tabs: it doesn't read a screen pushed from a row again, so after another
 * sign-in or a sign-out that screen would keep the old account's rows.
 */
function refreshCar(fromTheTop: boolean): void {
  forgetCarLists();
  shownLists.clear();
  if (CarPlayHelper.isAvailable()) {
    if (fromTheTop) CarPlayHelper.popToRoot();
    CarPlayHelper.reload();
  }
  if (AndroidAutoMediaLibraryHelper.isAvailable()) setAndroidAutoRoot();
}

const QUEUE = "queue";
/** Track ids are numbers or UUIDs, so this can't be one. */
const SHUFFLE_ROW = "shuffle";
const SIGNED_OUT_ROW = "signed-out";
/** Ends a list while more rows load; Android Auto's opens its list again. */
const LOADING_ROW = "loading";
const LOADING_TITLE = "Loading more…";

/** CarPlay's lists by template id, for playing a song picked in one. */
const shownLists = new Map<string, CarList>();
const MAX_SHOWN_LISTS = 20;

function registerCarPlay(): void {
  CarPlayHelper.set({
    templates: [
      tab(CAR_LISTS.library, "Library", "square.stack"),
      tab(CAR_LISTS.madeForYou, "Made for You", "sparkles"),
      tab(CAR_LISTS.recentlyPlayed, "Recently Played", "clock"),
      {
        type: "list",
        id: QUEUE,
        title: "Queue",
        source: "queue",
        tab: { title: "Queue", image: "list.bullet" },
      },
    ],
  });
  CarPlayHelper.setTemplateLoader(async (id) =>
    carPlayTemplate(id, await loadCarList(id)),
  );
  CarPlayHelper.onSelect((rowId, templateId) => {
    void playInCarPlay(templateId, rowId);
  });
}

function tab(id: string, title: string, image: string): CarPlayListTemplate {
  return { type: "list", id, title, lazy: true, tab: { title, image } };
}

function carPlayTemplate(id: string, list: CarList): CarPlayListTemplate {
  shownLists.delete(id);
  shownLists.set(id, list);
  for (const oldestId of shownLists.keys()) {
    if (shownLists.size <= MAX_SHOWN_LISTS) break;
    shownLists.delete(oldestId);
  }
  // An empty list keeps its empty title rather than a lone Shuffle.
  const shuffleItems: CarPlayListItem[] =
    list.shuffle && list.rows.length > 0
      ? // A symbol as the row's image fills the whole artwork slot.
        [{ id: SHUFFLE_ROW, title: "Shuffle", accessoryImage: "shuffle" }]
      : [];
  const loadingItems: CarPlayListItem[] = list.loadingMore
    ? [{ id: LOADING_ROW, title: LOADING_TITLE }]
    : [];
  const sections: CarPlayListSection[] = list.alphabetical
    ? [
        ...(shuffleItems.length > 0 ? [{ items: shuffleItems }] : []),
        ...byLetter(list.rows),
        ...(loadingItems.length > 0 ? [{ items: loadingItems }] : []),
      ]
    : [
        {
          items: [
            ...shuffleItems,
            ...list.rows.map(carPlayItem),
            ...loadingItems,
          ],
        },
      ];
  return {
    type: "list",
    id,
    title: list.title,
    sections,
    ...(list.emptyTitle ? { emptyTitle: list.emptyTitle } : {}),
  };
}

function carPlayItem(row: CarRow): CarPlayListItem {
  return {
    id: row.id,
    title: row.title,
    ...(row.subtitle ? { subtitle: row.subtitle } : {}),
    ...(row.image ? { image: row.image } : {}),
    // A song row has no playlistId, so it reaches onSelect and plays through
    // the facade; its trackId marks it while it plays.
    ...(row.kind === "list" ? { loadTemplate: true } : { trackId: row.id }),
  };
}

/** A section per letter, so CarPlay's side index can jump to one. */
function byLetter(rows: CarRow[]): CarPlayListSection[] {
  const sections: CarPlayListSection[] = [];
  for (const row of rows) {
    const letter = row.letter ?? "#";
    const last = sections[sections.length - 1];
    if (last?.header === letter) last.items.push(carPlayItem(row));
    else {
      sections.push({
        header: letter,
        indexTitle: letter,
        items: [carPlayItem(row)],
      });
    }
  }
  return sections;
}

async function playInCarPlay(templateId: string, rowId: string) {
  if (rowId === LOADING_ROW) return;
  // A list CarPlay kept on screen across a restart is read again.
  const list =
    shownLists.get(templateId) ??
    (await loadCarList(templateId).catch(() => null));
  const starting =
    rowId === SHUFFLE_ROW ? list?.shuffle?.() : list?.play?.(rowId);
  const started = await starting?.catch(() => false);
  if (started) CarPlayHelper.showNowPlaying();
}

/**
 * Lists of covers show as a grid; songs and artists as rows. Albums stay rows:
 * a large Library opens them on letters, which have no cover.
 */
const GRID_LISTS = new Set<string>([
  CAR_LISTS.playlists,
  CAR_LISTS.madeForYou,
  CAR_LISTS.recentlyPlayed,
]);

function registerAndroidAuto(): void {
  // Android Auto browses only once the engine is set up for it, and a pick
  // reaches the facade only through the engine.
  void preparePlayer().catch(() => {});
  setAndroidAutoRoot();
  AndroidAutoMediaLibraryHelper.setChildrenLoader(async (parentId) => {
    // Android Auto lets any row be opened. The sign-in row opens the Library,
    // which asks again until an account signs in.
    const listId =
      parentId === SIGNED_OUT_ROW
        ? CAR_LISTS.library
        : parentId.startsWith(`${LOADING_ROW}:`)
          ? parentId.slice(LOADING_ROW.length + 1)
          : parentId;
    return androidAutoItems(listId, await loadCarList(listId));
  });
  AndroidAutoMediaLibraryHelper.setSearchHandler(async (query) =>
    androidAutoItems(SEARCH_SHELF, await searchCar(query)),
  );
  // The car asked to play with nothing loaded: the last queue, where it
  // stopped. The engine plays it once it's loaded.
  AndroidAutoMediaLibraryHelper.onPlaybackResumption(() => {
    void headlessSession()
      .then((session) => (session ? restoreSavedQueue() : false))
      .catch(() => {});
  });
}

function setAndroidAutoRoot(): void {
  AndroidAutoMediaLibraryHelper.set({
    layoutType: "list",
    rootItems: [
      folder(CAR_LISTS.library, "Library"),
      folder(CAR_LISTS.madeForYou, "Made for You"),
      folder(CAR_LISTS.recentlyPlayed, "Recently Played"),
    ],
  });
}

/** A folder Android Auto reads through the children loader when opened. */
function folder(
  id: string,
  title: string,
  extra: Partial<MediaItem> = {},
): MediaItem {
  return {
    id,
    title,
    isPlayable: false,
    mediaType: "folder",
    children: [],
    layoutType:
      GRID_LISTS.has(id) || id.startsWith("artist:") ? "grid" : "list",
    ...extra,
  };
}

/** Each search's songs take the last search's place. */
const SEARCH_SHELF = "search";

async function androidAutoItems(
  listId: string,
  list: CarList,
): Promise<MediaItem[]> {
  // Android Auto has no text for an empty list, so signing in shows as a row.
  if (list.signedOut) {
    return [
      {
        id: SIGNED_OUT_ROW,
        title: list.emptyTitle ?? "",
        isPlayable: false,
        mediaType: "folder",
      },
    ];
  }
  const { songs = [], play, shuffle } = list;
  // Android Auto plays only songs from its lists, so Shuffle rides on the
  // shelf as a stand-in song, and a pick of it shuffles the list instead.
  const shelf =
    shuffle && list.rows.length > 0
      ? [shuffleStandIn(list.title), ...songs]
      : songs;
  const shelvedIds =
    shelf.length > 0
      ? await shelveForCar(listId, shelf, (trackId) =>
          trackId === SHUFFLE_ROW
            ? (shuffle?.() ?? Promise.resolve(false))
            : (play?.(trackId) ?? Promise.resolve(false)),
        )
      : [];
  const mediaIds = new Map(shelf.map(({ id }, i) => [id, shelvedIds[i]]));
  const shuffleId = mediaIds.get(SHUFFLE_ROW);
  const shuffleItems: MediaItem[] = shuffleId
    ? [
        {
          id: shuffleId,
          title: "Shuffle",
          ...(SHUFFLE_ICON ? { iconUrl: SHUFFLE_ICON } : {}),
          isPlayable: true,
          mediaType: "audio",
        },
      ]
    : [];
  const loadingItems: MediaItem[] = list.loadingMore
    ? [
        {
          id: `${LOADING_ROW}:${listId}`,
          title: LOADING_TITLE,
          isPlayable: false,
          mediaType: "folder",
        },
      ]
    : [];
  return [
    ...shuffleItems,
    ...list.rows.flatMap((row): MediaItem[] => {
      if (row.kind === "list") {
        return [
          folder(row.id, row.title, {
            ...(row.subtitle ? { subtitle: row.subtitle } : {}),
            ...(row.image ? { iconUrl: row.image } : {}),
          }),
        ];
      }
      const mediaId = mediaIds.get(row.id);
      if (!mediaId) return [];
      return [
        {
          id: mediaId,
          title: row.title,
          ...(row.subtitle ? { subtitle: row.subtitle } : {}),
          ...(row.image ? { iconUrl: row.image } : {}),
          isPlayable: true,
          mediaType: "audio",
        },
      ];
    }),
    ...loadingItems,
  ];
}

/** Media3's own shuffle icon, which the app ships. */
const SHUFFLE_ICON = Constants.expoConfig?.android?.package
  ? `android.resource://${Constants.expoConfig.android.package}/drawable/media3_icon_shuffle_on`
  : null;

/** What Android Auto shows for Shuffle while the pick is handed off. */
function shuffleStandIn(listTitle: string): PlayerTrack {
  return {
    id: SHUFFLE_ROW,
    title: "Shuffle",
    artist: listTitle,
    album: listTitle,
    duration: 0,
    url: "",
    artwork: null,
    streamPath: null,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
  };
}
