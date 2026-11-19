import { api, customHeadersFor } from "./client";
import type {
  Flow,
  FlowFormValues,
  FlowJob,
  FlowJobStatus,
  FlowStatusSnapshot,
  FlowTemplate,
  SharedPlaylist,
  SharedPlaylistTrack,
  WorkerSettings,
} from "@/lib/types/flow";

// Aurral 2.0 remounted the weekly-flow router at /api/playlists
// (`backend/server.js`: app.use("/api/playlists", weeklyFlowRouter)). The old
// /api/weekly-flow prefix still answers, but only as a 308 redirect shim — that
// costs a round-trip on every flow request and there is no guarantee upstream
// keeps it. Everything here targets the real mount.
const FLOW = "/playlists";

export async function getFlowStatus(): Promise<FlowStatusSnapshot> {
  const r = await api.get<FlowStatusSnapshot>(`${FLOW}/status`);
  return r.data;
}

/**
 * Per-playlist track jobs. The status snapshot stopped carrying a `jobs`
 * array in Aurral cc9dc1d5; this endpoint is the only source for a flow's
 * tracks. It also serves static playlists, ordered by their track order.
 */
export async function getPlaylistJobs(playlistId: string): Promise<FlowJob[]> {
  const r = await api.get<FlowJob[]>(
    `${FLOW}/jobs/${encodeURIComponent(playlistId)}`,
  );
  return r.data;
}

/**
 * Ids of the static playlists that already hold the track, matched the way
 * the server matches an append.
 */
export async function getPlaylistsContaining(
  track: SharedPlaylistTrack,
): Promise<string[]> {
  const r = await api.get<{
    playlists: { id: string; jobId: string | null }[];
  }>(`${FLOW}/containing`, {
    params: {
      artistName: track.artistName,
      trackName: track.trackName,
      albumName: track.albumName,
      artistMbid: track.artistMbid,
      albumMbid: track.albumMbid,
      trackMbid: track.trackMbid,
      releaseYear: track.releaseYear,
    },
  });
  return r.data.playlists.map((playlist) => playlist.id);
}

export async function getWorkerSettings(): Promise<WorkerSettings> {
  const r = await api.get<WorkerSettings>(`${FLOW}/worker/settings`);
  return r.data;
}

export async function updateWorkerSettings(
  settings: Partial<WorkerSettings>,
): Promise<WorkerSettings> {
  const r = await api.put<{ success: boolean; settings: WorkerSettings }>(
    `${FLOW}/worker/settings`,
    settings,
  );
  return r.data.settings;
}

export async function createFlow(payload: FlowFormValues): Promise<Flow> {
  const r = await api.post<{ success: boolean; flow: Flow }>(
    `${FLOW}/flows`,
    payload,
  );
  return r.data.flow;
}

export async function getFlowTemplates(): Promise<FlowTemplate[]> {
  const r = await api.get<{ templates: FlowTemplate[] }>(
    `${FLOW}/flow-templates`,
  );
  return r.data.templates;
}

export async function createFlowFromTemplate(
  templateId: string,
): Promise<Flow> {
  const r = await api.post<{ success: boolean; flow: Flow }>(`${FLOW}/flows`, {
    templateId,
  });
  return r.data.flow;
}

export async function updateFlow(
  flowId: string,
  payload: Partial<FlowFormValues>,
): Promise<Flow> {
  const r = await api.put<{ success: boolean; flow: Flow }>(
    `${FLOW}/flows/${flowId}`,
    payload,
  );
  return r.data.flow;
}

export async function deleteFlow(flowId: string): Promise<void> {
  await api.delete(`${FLOW}/flows/${flowId}`);
}

export async function setFlowEnabled(
  flowId: string,
  enabled: boolean,
): Promise<void> {
  await api.put(`${FLOW}/flows/${flowId}/enabled`, { enabled });
}

export async function startFlow(flowId: string, limit?: number): Promise<void> {
  await api.post(`${FLOW}/start/${flowId}`, limit ? { limit } : {});
}

/**
 * Answers 409, with a message naming the sources to set up, when no download
 * source is configured.
 */
export async function downloadSavedFlowTracks(flowId: string): Promise<void> {
  await api.post(`${FLOW}/flows/${flowId}/download`);
}

/** Downloads a `saved` track, or searches again for any other finished one. */
export async function researchFlowTrack(
  flowId: string,
  jobId: string,
): Promise<void> {
  await api.post(`${FLOW}/flows/${flowId}/tracks/${jobId}/research`);
}

export async function convertFlowToStaticPlaylist(
  flowId: string,
  name?: string,
): Promise<SharedPlaylist> {
  const r = await api.post<{ success: boolean; playlist: SharedPlaylist }>(
    `${FLOW}/flows/${flowId}/static-playlist`,
    name ? { name } : {},
  );
  return r.data.playlist;
}

/**
 * Static-playlist creation and track appends run on the server's operation
 * queue. The response carries ids only; the new state arrives through the
 * status poll once the operation completes.
 */
export type QueuedSharedPlaylistOperation = {
  playlistId: string;
  operationId: string;
};

export async function createSharedPlaylist(payload: {
  name: string;
  tracks?: SharedPlaylistTrack[];
}): Promise<QueuedSharedPlaylistOperation> {
  const r = await api.post<{
    success: boolean;
    playlistId: string;
    queued: boolean;
    operationId: string;
  }>(`${FLOW}/static-playlists`, payload);
  return { playlistId: r.data.playlistId, operationId: r.data.operationId };
}

/** The server skips tracks the playlist already contains. */
export async function addSharedPlaylistTracks(
  playlistId: string,
  tracks: SharedPlaylistTrack[],
): Promise<QueuedSharedPlaylistOperation> {
  const r = await api.post<{
    success: boolean;
    playlistId: string;
    queued: boolean;
    operationId: string;
  }>(`${FLOW}/static-playlists/${playlistId}/tracks`, { tracks });
  return { playlistId: r.data.playlistId, operationId: r.data.operationId };
}

export async function updateSharedPlaylist(
  playlistId: string,
  payload: { name?: string; tracks?: SharedPlaylistTrack[] },
): Promise<SharedPlaylist> {
  const r = await api.put<{ success: boolean; playlist: SharedPlaylist }>(
    `${FLOW}/static-playlists/${playlistId}`,
    payload,
  );
  return r.data.playlist;
}

export async function deleteSharedPlaylist(playlistId: string): Promise<void> {
  await api.delete(`${FLOW}/static-playlists/${playlistId}`);
}

export async function deleteSharedPlaylistTrack(
  playlistId: string,
  jobId: string,
): Promise<void> {
  await api.delete(`${FLOW}/static-playlists/${playlistId}/tracks/${jobId}`);
}

/** The server answers 409 while the track is pending or downloading. */
export async function researchSharedPlaylistTrack(
  playlistId: string,
  jobId: string,
): Promise<void> {
  await api.post(
    `${FLOW}/static-playlists/${playlistId}/tracks/${jobId}/research`,
  );
}

export type FlowAuthedSource = {
  uri: string;
  headers?: Record<string, string>;
};

function authedSource(uri: string, token: string | null): FlowAuthedSource {
  const headers = customHeadersFor(uri);
  if (token) headers.Authorization = `Bearer ${token}`;
  return Object.keys(headers).length > 0 ? { uri, headers } : { uri };
}

/** The player adds the session token. */
export function getFlowStreamPath(jobId: string): string {
  return `${FLOW}/stream/${encodeURIComponent(jobId)}`;
}

/** Server-relative, as a queued track's `coverPath` is. */
export function getFlowArtworkPath(
  playlistId: string,
  artworkRevision?: number,
): string {
  const version = artworkRevision != null ? `?v=${artworkRevision}` : "";
  return `/api${FLOW}/artwork/${encodeURIComponent(playlistId)}${version}`;
}

/**
 * The URL is expo-image's cache key, so the artwork revision goes in it and
 * a regenerated or uploaded cover replaces the cached one.
 */
export function getFlowArtworkSource(
  playlistId: string,
  token: string | null,
  artworkRevision?: number,
): FlowAuthedSource {
  const base = api.defaults.baseURL;
  const version = artworkRevision != null ? `?v=${artworkRevision}` : "";
  return authedSource(
    `${base}${FLOW}/artwork/${encodeURIComponent(playlistId)}${version}`,
    token,
  );
}

/**
 * Blocked download jobs wait for a decision before Aurral imports them. The
 * jobId comes from an activity entry with status "blocked".
 */
export async function approveBlockedJob(jobId: string) {
  const r = await api.post(`${FLOW}/jobs/${encodeURIComponent(jobId)}/approve`);
  return r.data;
}

export async function denyBlockedJob(jobId: string) {
  const r = await api.post(`${FLOW}/jobs/${encodeURIComponent(jobId)}/deny`);
  return r.data;
}

/**
 * `status` is "cancel_requested" when the download client's cleanup is still
 * running; the job reaches "cancelled" once it finishes.
 */
export type TrackJobControlResult = {
  jobId: string;
  status: FlowJobStatus;
};

export async function cancelTrackJob(
  jobId: string,
): Promise<TrackJobControlResult> {
  const r = await api.post<TrackJobControlResult>(
    `${FLOW}/jobs/${encodeURIComponent(jobId)}/cancel`,
  );
  return r.data;
}

/** An active download is stopped first, then queued again. */
export async function retryTrackJob(
  jobId: string,
): Promise<TrackJobControlResult> {
  const r = await api.post<TrackJobControlResult>(
    `${FLOW}/jobs/${encodeURIComponent(jobId)}/retry`,
  );
  return r.data;
}
