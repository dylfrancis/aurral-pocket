import { api } from "./client";
import type {
  Flow,
  FlowFormValues,
  FlowStatusSnapshot,
  SharedPlaylist,
  SharedPlaylistTrack,
  WorkerSettings,
} from "@/lib/types/flow";

export async function getFlowStatus(): Promise<FlowStatusSnapshot> {
  const r = await api.get<FlowStatusSnapshot>("/weekly-flow/status", {
    params: { includeJobs: 1 },
  });
  return r.data;
}

export async function getWorkerSettings(): Promise<WorkerSettings> {
  const r = await api.get<WorkerSettings>("/weekly-flow/worker/settings");
  return r.data;
}

export async function updateWorkerSettings(
  settings: Partial<WorkerSettings>,
): Promise<WorkerSettings> {
  const r = await api.put<{ success: boolean; settings: WorkerSettings }>(
    "/weekly-flow/worker/settings",
    settings,
  );
  return r.data.settings;
}

export async function createFlow(payload: FlowFormValues): Promise<Flow> {
  const r = await api.post<{ success: boolean; flow: Flow }>(
    "/weekly-flow/flows",
    payload,
  );
  return r.data.flow;
}

export async function updateFlow(
  flowId: string,
  payload: Partial<FlowFormValues>,
): Promise<Flow> {
  const r = await api.put<{ success: boolean; flow: Flow }>(
    `/weekly-flow/flows/${flowId}`,
    payload,
  );
  return r.data.flow;
}

export async function deleteFlow(flowId: string): Promise<void> {
  await api.delete(`/weekly-flow/flows/${flowId}`);
}

export async function setFlowEnabled(
  flowId: string,
  enabled: boolean,
): Promise<void> {
  await api.put(`/weekly-flow/flows/${flowId}/enabled`, { enabled });
}

export async function startFlow(flowId: string, limit?: number): Promise<void> {
  await api.post(`/weekly-flow/start/${flowId}`, limit ? { limit } : {});
}

export async function convertFlowToStaticPlaylist(
  flowId: string,
  name?: string,
): Promise<SharedPlaylist> {
  const r = await api.post<{ success: boolean; playlist: SharedPlaylist }>(
    `/weekly-flow/flows/${flowId}/static-playlist`,
    name ? { name } : {},
  );
  return r.data.playlist;
}

export async function updateSharedPlaylist(
  playlistId: string,
  payload: { name?: string; tracks?: SharedPlaylistTrack[] },
): Promise<SharedPlaylist> {
  const r = await api.put<{ success: boolean; playlist: SharedPlaylist }>(
    `/weekly-flow/shared-playlists/${playlistId}`,
    payload,
  );
  return r.data.playlist;
}

export async function deleteSharedPlaylist(playlistId: string): Promise<void> {
  await api.delete(`/weekly-flow/shared-playlists/${playlistId}`);
}

export async function deleteSharedPlaylistTrack(
  playlistId: string,
  jobId: string,
): Promise<void> {
  await api.delete(
    `/weekly-flow/shared-playlists/${playlistId}/tracks/${jobId}`,
  );
}

export async function setRetryCyclePaused(
  playlistId: string,
  paused: boolean,
): Promise<void> {
  await api.put(`/weekly-flow/playlists/${playlistId}/retry-cycle`, { paused });
}

export function getFlowStreamUrl(jobId: string, token: string | null): string {
  const base = api.defaults.baseURL;
  const url = `${base}/weekly-flow/stream/${encodeURIComponent(jobId)}`;
  if (!token) return url;
  return `${url}?token=${encodeURIComponent(token)}`;
}

export function getFlowArtworkUrl(
  playlistId: string,
  token: string | null,
): string {
  const base = api.defaults.baseURL;
  const url = `${base}/weekly-flow/artwork/${encodeURIComponent(playlistId)}`;
  if (!token) return url;
  return `${url}?token=${encodeURIComponent(token)}`;
}
