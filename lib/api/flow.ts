import { api, buildAuthenticatedUrl } from "./client";
import type {
  Flow,
  FlowFormValues,
  FlowJob,
  FlowStatusSnapshot,
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
 * tracks. It also serves shared playlists, ordered by their track order.
 */
export async function getPlaylistJobs(playlistId: string): Promise<FlowJob[]> {
  const r = await api.get<FlowJob[]>(
    `${FLOW}/jobs/${encodeURIComponent(playlistId)}`,
  );
  return r.data;
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
 * Shared-playlist creation and track appends run on the server's operation
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
  }>(`${FLOW}/shared-playlists`, payload);
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
  }>(`${FLOW}/shared-playlists/${playlistId}/tracks`, { tracks });
  return { playlistId: r.data.playlistId, operationId: r.data.operationId };
}

export async function updateSharedPlaylist(
  playlistId: string,
  payload: { name?: string; tracks?: SharedPlaylistTrack[] },
): Promise<SharedPlaylist> {
  const r = await api.put<{ success: boolean; playlist: SharedPlaylist }>(
    `${FLOW}/shared-playlists/${playlistId}`,
    payload,
  );
  return r.data.playlist;
}

export async function deleteSharedPlaylist(playlistId: string): Promise<void> {
  await api.delete(`${FLOW}/shared-playlists/${playlistId}`);
}

export async function deleteSharedPlaylistTrack(
  playlistId: string,
  jobId: string,
): Promise<void> {
  await api.delete(`${FLOW}/shared-playlists/${playlistId}/tracks/${jobId}`);
}

export async function setRetryCyclePaused(
  playlistId: string,
  paused: boolean,
): Promise<void> {
  // The doubled segment is real: upstream registers this as
  // `/playlists/:playlistId/retry-cycle` on a router already mounted at
  // /api/playlists, so the served path is /api/playlists/playlists/:id/...
  await api.put(`${FLOW}/playlists/${playlistId}/retry-cycle`, { paused });
}

export type FlowAuthedSource = {
  uri: string;
  headers?: Record<string, string>;
};

function authedSource(uri: string, token: string | null): FlowAuthedSource {
  return token
    ? { uri, headers: { Authorization: `Bearer ${token}` } }
    : { uri };
}

/**
 * The URL that streams a finished download job — self-authenticating because
 * the audio engine sends no headers (see buildAuthenticatedUrl). Artwork
 * keeps its header; expo-image can send one. Null while signed out.
 */
export function getFlowStreamUrl(jobId: string): string | null {
  return buildAuthenticatedUrl(`${FLOW}/stream/${encodeURIComponent(jobId)}`);
}

export function getFlowArtworkSource(
  playlistId: string,
  token: string | null,
): FlowAuthedSource {
  const base = api.defaults.baseURL;
  return authedSource(
    `${base}${FLOW}/artwork/${encodeURIComponent(playlistId)}`,
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
