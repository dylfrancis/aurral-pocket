# Flows and Playlists — aurral-pocket Mobile Design

Date: 2026-04-26
Status: Approved (pending implementation plan)
Companion repo: `../aurral` (Express backend + Vite web frontend)

## Goal

Bring full management of Aurral **flows** (dynamic, scheduled playlists) and **shared playlists** (static, imported tracklists) into the React Native mobile app, matching web feature parity **except JSON import**. Read paths stay live via short-interval polling. A single shared `expo-audio` player provides tap-to-play preview from the existing stream endpoint.

## Out of scope

- JSON import (POST `/weekly-flow/shared-playlists/import`) — stays on web.
- Persistent mini-player, queue playback, lock-screen / Now-Playing controls.
- WebSocket realtime updates.
- Notifications / Gotify / webhook config.
- Reset-all and worker start/stop endpoints — covered indirectly through worker settings; raw start/stop is not surfaced.

## Backend surface used

All routes are gated by `accessFlow` permission and require Bearer auth. Bases off `/api/weekly-flow`.

Read:

- `GET /status?includeJobs=1` — single snapshot: `{ worker, soulseek, stats, flowStats, sharedStats, sharedPlaylistStats, jobs, flows, sharedPlaylists, retryCyclePausedByPlaylist, retryCycleScheduledByPlaylist, operationQueue, hint }`.
- `GET /worker/settings` — `{ concurrency, preferredFormat, preferredFormatStrict, retryCycleMinutes }`.
- `GET /stream/:jobId` (token auth via `?token=`) — audio stream, range-supported.
- `GET /artwork/:playlistId` (token auth via `?token=`) — playlist PNG.

Write:

- `POST /flows`, `PUT /flows/:id`, `DELETE /flows/:id`.
- `PUT /flows/:id/enabled`.
- `POST /start/:id` (manual run).
- `POST /flows/:id/static-playlist` (convert to static).
- `PUT /shared-playlists/:id`, `DELETE /shared-playlists/:id`.
- `DELETE /shared-playlists/:id/tracks/:jobId`.
- `PUT /playlists/:id/retry-cycle`.
- `PUT /worker/settings`.

## Information architecture

```
app/(app)/(tabs)/(flow)/
├── _layout.tsx          # Stack with transparent header, audio player provider mount
├── index.tsx            # Sectioned list (Flows / Playlists), bottom sheets, FAB/toolbar
├── flow-edit.tsx        # Pushed: create or edit a flow
├── playlist-edit.tsx    # Pushed: rename and edit tracks of a static playlist
└── worker-settings.tsx  # Pushed: concurrency / preferred format / retry cycle
```

### Index screen

A sectioned `FlashList` with two sections:

1. **Flows** — `FlowCard` per dynamic flow.
2. **Playlists** — `PlaylistCard` per static playlist.

Header right toolbar:

- `+` menu → "Create flow" (push `flow-edit`).
- Gear icon → push `worker-settings`.

Tap a card → open the matching detail sheet.

Empty state when both lists are empty: prompt with a "Create your first flow" CTA.

### Detail sheets

Both sheets are `@gorhom/bottom-sheet` with a single 90% snap point (no intermediate snap), `BottomSheetFlashList` for the tracks. Tapping outside or pulling down dismisses.

**`FlowDetailSheet`**:

- Header: name, "Edit" pencil → push `flow-edit?id=`. Dismisses sheet on push.
- Status row: phase + next-run hint from `status.hint`.
- Enabled switch (calls `useSetFlowEnabled`).
- Action buttons: "Start Now", "Convert to Static", "Pause/Resume Retry", "Delete" (destructive, confirm alert).
- Tracks list: each row uses shared `TrackRow` with status badge; `done` rows are tappable to play/pause preview, others are inert.

**`PlaylistDetailSheet`**:

- Header: name, "Edit" pencil → push `playlist-edit?id=`.
- Action buttons: "Pause/Resume Retry", "Delete".
- Tracks list: same `TrackRow`, swipe-to-remove on `done` rows (calls `useDeleteSharedPlaylistTrack`).

### Edit screens

**`flow-edit.tsx`**: Receives optional `id` param. Hydrates from cached status when editing; defaults to the same template the web uses (`Discover`, size 30, balanced 50/30/20 mix). Sections in a vertical scrollview, each in a card:

- Name (`TextInput`).
- Mix: 3-channel constrained sliders summing to 100, with the same `MIX_PRESETS` as web (Balanced, Discover Focus, Library Mix, Trending Lift, Custom).
- Size stepper (10–100, step 5).
- Deep Dive toggle.
- Focus: tag chips and related-artist chips, each chip carries a Light/Medium/Heavy strength selector matching web's `FOCUS_STRENGTHS`.
- Schedule: 7-day toggle row + hour-only picker (matches backend `HH:00` normalization).

Header right: "Save" → mutation → on success `router.back()`. Form validation via `react-hook-form` + `zod` (already in deps). Cancel via header back.

**`playlist-edit.tsx`**: Receives `id`. Form has:

- Name `TextInput`.
- Tracks list with reorder handle and remove button per row.

Save → `useUpdateSharedPlaylist` with normalized tracks → `router.back()`.

**`worker-settings.tsx`**: Auto-saves on change with a debounced PUT. Optimistic update of the `useWorkerSettings` cache; revert on error.

- Concurrency: segmented `1 / 2 / 3`.
- Preferred format: segmented `flac / mp3` + a "Strict" toggle.
- Retry cycle: segmented from `[15, 30, 60, 360, 720, 1440]` (minutes).

## Data layer

```
lib/
├── api/flow.ts                 # All endpoint helpers + stream/artwork URL builders
├── types/flow.ts               # Flow, SharedPlaylist, FlowJob, WorkerStatus,
│                               # StatusSnapshot, WorkerSettings, FlowFormValues, etc.
└── query-keys.ts               # add flowKeys.{ status, workerSettings }
```

`flowKeys`:

```ts
export const flowKeys = {
  status: () => ["flow", "status"] as const,
  workerSettings: () => ["flow", "worker", "settings"] as const,
};
```

`lib/api/flow.ts` exposes one function per backend route plus URL builders that mirror the web pattern (token query param):

- `getFlowStreamUrl(jobId)` and `getFlowArtworkUrl(playlistId)` return strings; consumers pass to `expo-audio` / `expo-image`.

## Hooks

One file per concern, under `hooks/flow/`. Read/derived state is a selector over the polled `useFlowStatus()` cache, so we never duplicate fetches.

Queries:

- `use-flow-status` — `useQuery({ queryKey: flowKeys.status(), queryFn, refetchInterval: 3000 })`. Interval is paused when the (flow) tab loses focus via `useFocusEffect` toggling a state that drives `refetchInterval`. Stale time short.
- `use-worker-settings` — `useQuery` on the settings endpoint.

Selectors over the status cache (no extra fetch):

- `useFlows()`, `useFlow(id)`, `useSharedPlaylists()`, `useSharedPlaylist(id)`, `useFlowJobs(id)`, `usePlaylistJobs(id)`, `useStatusHint()`, `useRetryCyclePaused(playlistId)`.

Mutations (each invalidates `flowKeys.status` on success):

- `use-create-flow`, `use-update-flow`, `use-delete-flow`.
- `use-set-flow-enabled`, `use-start-flow`.
- `use-convert-flow-to-static`.
- `use-update-shared-playlist`, `use-delete-shared-playlist`, `use-delete-shared-playlist-track`.
- `use-set-retry-cycle-paused`.
- `use-update-worker-settings` — invalidates `flowKeys.workerSettings`.

Local state:

- `use-flow-audio-preview` — owns a single `expo-audio` `useAudioPlayer`. State `{ activeJobId, isPlaying }`. `toggle(jobId)`: same id → pause/resume; different id → swap source to `getFlowStreamUrl(jobId)` and play. Stops on tab blur and on unmount.

## Components

Under `components/flow/`:

- `FlowCard` — name, mix bar, size, schedule chip, enabled switch, status hint.
- `PlaylistCard` — name, track count, retry-paused chip, status hint, artwork via `getFlowArtworkUrl`.
- `FlowDetailSheet`, `PlaylistDetailSheet` — see sheet contents above.
- `TrackRow` — artist · track / album subtitle, status badge, active-play indicator. One component used in both sheets.
- `StatusBadge` — pending / downloading / done / failed pill.
- `MixSlider` — 3-channel constrained sliders.
- `MixPresetPicker` — chip row for the named presets.
- `FocusChips` — tag and related-artist editor with light/medium/heavy strength.
- `ScheduleDayPicker` — 7-day toggle row.
- `ScheduleTimePicker` — hour-only picker (24 entries).
- `DeepDiveToggle`, `SizeStepper`.
- Reuse `components/library/EmptyState` for empty states.

## Audio playback

Tap-to-play preview only. Single `expo-audio` player, swap source on tap. No queue, no background continuation, no lock-screen controls. Stops on screen blur. URL includes the auth token as a query param, matching the web pattern.

## Polling

`useFlowStatus` is the only repeated network call. While the (flow) tab is focused, `refetchInterval: 3000`; off-focus, the interval clears. The query is mounted at the layout level so any nested screen still benefits from the same cache without remounting.

Manual refresh: standard `RefreshControl` on the index list calls `refetch()`.

## Permissions

`(flow)` tab is shown only when `useHasPermission("accessFlow")` is true (uses the existing `NativeTabs.Trigger.hidden` mechanism, mirroring `(settings)`). All hooks assume permission is present once the tab is reachable.

## Error handling

- Mutation errors surface as a toast (existing toast pattern via context).
- 401 is handled by the global re-auth flow in `lib/api/client.ts`.
- Network errors during polling are silent; the last good snapshot is shown.

## Type contracts (sketch)

```ts
// lib/types/flow.ts
export type MixPercent = { discover: number; mix: number; trending: number };
export type FocusStrength = "light" | "medium" | "heavy";
export type FocusEntry = { value: string; strength: FocusStrength };

export type Flow = {
  id: string;
  name: string;
  enabled: boolean;
  size: number;
  mix: MixPercent;
  deepDive: boolean;
  tags: Record<string, FocusStrength>;
  relatedArtists: Record<string, FocusStrength>;
  scheduleDays: number[];
  scheduleTime: string; // "HH:00"
  nextRunAt: number | null;
};

export type SharedPlaylist = {
  id: string;
  name: string;
  sourceName: string | null;
  sourceFlowId: string | null;
  trackCount: number;
};

export type FlowJobStatus = "pending" | "downloading" | "done" | "failed";
export type FlowJob = {
  id: string;
  playlistType: string; // flowId or sharedPlaylistId
  artistName: string;
  trackName: string;
  albumName: string | null;
  artistMbid: string | null;
  status: FlowJobStatus;
  finalPath?: string;
  reason?: string | null;
};

export type StatusHint = {
  phase: "idle" | "preparing" | "downloading" | "queued" | "completed";
  message: string;
};

export type WorkerSettings = {
  concurrency: 1 | 2 | 3;
  preferredFormat: "flac" | "mp3";
  preferredFormatStrict: boolean;
  retryCycleMinutes: 15 | 30 | 60 | 360 | 720 | 1440;
};

export type FlowStatusSnapshot = {
  worker: { processing: boolean; stats: PlaylistStats };
  soulseek: { configured: boolean; connected: boolean };
  stats: PlaylistStats;
  flowStats: Record<string, PlaylistStats>;
  sharedStats: PlaylistStats;
  sharedPlaylistStats: Record<string, PlaylistStats>;
  jobs?: FlowJob[];
  flows: Flow[];
  sharedPlaylists: SharedPlaylist[];
  retryCyclePausedByPlaylist: Record<string, boolean>;
  retryCycleScheduledByPlaylist: Record<string, boolean>;
  operationQueue: { processing: boolean; currentLabel: string | null };
  hint: StatusHint;
};

export type PlaylistStats = {
  total: number;
  pending: number;
  downloading: number;
  done: number;
  failed: number;
};
```

## Implementation notes

- `useFlowStatus` and `useWorkerSettings` stay separate queries: the settings endpoint changes rarely and isn't part of the polled snapshot.
- Track reorder in `playlist-edit` uses up/down arrow buttons per row to avoid pulling in a drag library; a future revision can swap to drag-and-drop without changing the save contract.
- `MixSlider` is built with `react-native-gesture-handler` + `react-native-reanimated` (already in deps): three independent gesture sliders, releasing one rebalances the other two proportionally so the sum stays at 100.

## Non-goals (explicit)

- Lidarr-aware library actions inside flow tracks (e.g., "add this artist to library") — flows are deliberately separate from the main library; a future iteration may add it.
- Editing the source flowId / sourceName of a static playlist — backend doesn't expose it on PUT either.
