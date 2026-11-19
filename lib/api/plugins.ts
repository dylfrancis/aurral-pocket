import { api } from "./client";
import type { PluginAction, PluginActionInput } from "@/lib/types/plugins";

/**
 * Aurral gives a plugin 2 minutes to answer an action. Waiting longer lets
 * Aurral's own answer, or its timeout error, arrive first.
 */
const ACTION_TIMEOUT_MS = 150_000;

/**
 * Aurral leaves out admin-only actions for anyone else, and lists none in safe
 * mode.
 */
export async function getPluginActions(): Promise<PluginAction[]> {
  const r = await api.get<{ actions?: PluginAction[] }>("/plugins/actions");
  return r.data.actions ?? [];
}

/**
 * Returns what to tell the user. A background action answers at once with
 * "… started", and its result comes later on the `plugins` channel.
 */
export async function runPluginAction(
  action: PluginAction,
  input: PluginActionInput,
): Promise<string> {
  const r = await api.post<{ message: string }>(
    `/plugins/${encodeURIComponent(action.pluginId)}/actions/${encodeURIComponent(action.id)}`,
    input,
    { timeout: ACTION_TIMEOUT_MS },
  );
  return r.data.message;
}
