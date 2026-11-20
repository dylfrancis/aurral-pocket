import {
  AndroidAutoMediaLibraryHelper,
  CarPlayHelper,
  type CarPlayListTemplate,
  type MediaItem,
} from "react-native-nitro-player";
import {
  CAR_LISTS,
  forgetCarLists,
  loadCarList,
  searchCar,
  type CarList,
} from "@/hooks/car/car-library";
import { headlessSession, onSessionCleared } from "@/lib/headless-session";
import {
  preparePlayer,
  restoreSavedQueue,
  shelveForCar,
} from "@/lib/player/player";

/**
 * Draws pocket's lists in CarPlay and Android Auto through the audio engine.
 * Call it from the app's entry: a car can open the app with no screen.
 */
export function registerCar(): void {
  const carPlay = CarPlayHelper.isAvailable();
  const androidAuto = AndroidAutoMediaLibraryHelper.isAvailable();
  if (carPlay) registerCarPlay();
  if (androidAuto) registerAndroidAuto();
  // The lists then ask to sign in on the phone.
  if (carPlay || androidAuto) onSessionCleared(refreshCar);
}

/** Read every list the car shows again, such as for another account. */
export function refreshCar(): void {
  forgetCarLists();
  shownLists.clear();
  if (CarPlayHelper.isAvailable()) CarPlayHelper.reload();
  if (AndroidAutoMediaLibraryHelper.isAvailable()) setAndroidAutoRoot();
}

const QUEUE = "queue";
/** Track ids are numbers or UUIDs, so this can't be one. */
const SHUFFLE_ROW = "shuffle";
const SIGNED_OUT_ROW = "signed-out";

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
  return {
    type: "list",
    id,
    title: list.title,
    sections: [
      {
        items: [
          // An empty list keeps its empty title rather than a lone Shuffle.
          ...(list.shuffle && list.rows.length > 0
            ? [
                // A symbol as the row's image fills the whole artwork slot.
                {
                  id: SHUFFLE_ROW,
                  title: "Shuffle",
                  accessoryImage: "shuffle",
                },
              ]
            : []),
          ...list.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.subtitle ? { subtitle: row.subtitle } : {}),
            ...(row.image ? { image: row.image } : {}),
            // A song row has no playlistId, so it reaches onSelect and plays
            // through the facade; its trackId marks it while it plays.
            ...(row.kind === "list"
              ? { loadTemplate: true }
              : { trackId: row.id }),
          })),
        ],
      },
    ],
    ...(list.emptyTitle ? { emptyTitle: list.emptyTitle } : {}),
  };
}

async function playInCarPlay(templateId: string, rowId: string) {
  // A list CarPlay kept on screen across a restart is read again.
  const list =
    shownLists.get(templateId) ??
    (await loadCarList(templateId).catch(() => null));
  const start = rowId === SHUFFLE_ROW ? list?.shuffle?.() : list?.play?.(rowId);
  const started = await start?.catch(() => false);
  if (started) CarPlayHelper.showNowPlaying();
}

/** Lists of covers show as a grid; songs and artists as rows. */
const GRID_LISTS = new Set<string>([
  CAR_LISTS.playlists,
  CAR_LISTS.albums,
  CAR_LISTS.madeForYou,
  CAR_LISTS.recentlyPlayed,
]);

function registerAndroidAuto(): void {
  // Android Auto browses only once the engine is set up for it, and a pick
  // reaches the facade only through the engine.
  void preparePlayer().catch(() => {});
  setAndroidAutoRoot();
  AndroidAutoMediaLibraryHelper.setChildrenLoader(async (parentId) =>
    // Android Auto lets any row be opened. The sign-in row opens the Library,
    // which asks again until an account signs in.
    androidAutoItems(
      await loadCarList(
        parentId === SIGNED_OUT_ROW ? CAR_LISTS.library : parentId,
      ),
    ),
  );
  AndroidAutoMediaLibraryHelper.setSearchHandler(async (query) =>
    androidAutoItems(await searchCar(query)),
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

async function androidAutoItems(list: CarList): Promise<MediaItem[]> {
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
  const { songs, play } = list;
  const shelvedIds =
    songs?.length && play ? await shelveForCar(songs, play) : [];
  const mediaIds = new Map(songs?.map(({ id }, i) => [id, shelvedIds[i]]));
  return list.rows.flatMap((row): MediaItem[] => {
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
  });
}
