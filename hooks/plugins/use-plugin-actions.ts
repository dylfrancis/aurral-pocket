import { useMemo } from "react";
import { useMutation, useMutationState, useQuery } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useLiveChannel } from "@/hooks/live/use-live-channel";
import { ApiError } from "@/lib/api/client";
import { getPluginActions, runPluginAction } from "@/lib/api/plugins";
import { pluginKeys } from "@/lib/query-keys";
import type {
  PluginAction,
  PluginActionInput,
  PluginActionInputByTarget,
  PluginActionTarget,
} from "@/lib/types/plugins";

export type PluginMenuItem = {
  key: string;
  label: string;
  /** Until Aurral answers, which takes up to 2 minutes. */
  running: boolean;
  run: () => void;
};

type PluginRun = { action: PluginAction; input: PluginActionInput };

// Only an admin on the web changes plugins, so a few minutes' lag is fine.
const ACTIONS_STALE_MS = 5 * 60_000;

const NO_ITEMS: PluginMenuItem[] = [];

function runKey(action: PluginAction, inputJson: string): string {
  return `${action.pluginId}/${action.id}/${inputJson}`;
}

/**
 * None while `input` is null. Each result is toasted, even once the menu's
 * screen has closed.
 */
export function usePluginActions<T extends PluginActionTarget>(
  target: T,
  input: PluginActionInputByTarget[T] | null,
): PluginMenuItem[] {
  const { data: actions } = useQuery({
    queryKey: pluginKeys.actions(),
    queryFn: getPluginActions,
    staleTime: ACTIONS_STALE_MS,
  });
  const running = useMutationState({
    filters: { mutationKey: pluginKeys.run(), status: "pending" },
    select: (mutation) => {
      const { action, input } = mutation.state.variables as PluginRun;
      return runKey(action, JSON.stringify(input));
    },
  });
  // Hook-level callbacks, because React Query drops mutate()'s own once the
  // caller unmounts.
  const { mutate } = useMutation({
    mutationKey: pluginKeys.run(),
    mutationFn: ({ action, input }: PluginRun) =>
      runPluginAction(action, input),
    onSuccess: (message) => toastPluginResult(true, message),
    onError: (error, { action }) => {
      // Without an answer from Aurral, the title says which action failed.
      if (error instanceof ApiError && !error.isNetworkError) {
        toastPluginResult(false, error.message);
      } else {
        toastPluginResult(false, `Couldn't run ${action.label}`, error.message);
      }
    },
  });

  // Callers build the input inline, so it's compared by its JSON.
  const inputJson = input ? JSON.stringify(input) : null;
  return useMemo(() => {
    if (!inputJson || !actions) return NO_ITEMS;
    const runInput = JSON.parse(inputJson) as PluginActionInput;
    return actions
      .filter((action) => action.target === target)
      .map((action) => {
        const key = runKey(action, inputJson);
        return {
          key,
          label: action.label,
          running: running.includes(key),
          run: () => mutate({ action, input: runInput }),
        };
      });
  }, [actions, inputJson, mutate, running, target]);
}

/**
 * Toasts a background action's result when it finishes. Aurral keeps no copy,
 * so a result that finishes while the socket is closed is never shown.
 */
export function usePluginActionResults() {
  useLiveChannel("plugins", ["plugin_action_finished"], (message) =>
    toastPluginResult(message.ok, message.message),
  );
}

/** Android shows a toast's title alone, so what must be read goes there. */
function toastPluginResult(ok: boolean, title: string, message?: string) {
  void Haptics.notificationAsync(
    ok
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error,
  );
  Burnt.toast({ title, message, preset: ok ? "done" : "error" });
}
