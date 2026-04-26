import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  convertFlowToStaticPlaylist,
  createFlow,
  deleteFlow,
  deleteSharedPlaylist,
  deleteSharedPlaylistTrack,
  setFlowEnabled,
  setRetryCyclePaused,
  startFlow,
  updateFlow,
  updateSharedPlaylist,
} from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type {
  FlowFormValues,
  FlowStatusSnapshot,
  SharedPlaylistTrack,
} from "@/lib/types/flow";

function useFlowInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: flowKeys.status() });
}

export function useCreateFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (payload: FlowFormValues) => createFlow(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      flowId,
      payload,
    }: {
      flowId: string;
      payload: Partial<FlowFormValues>;
    }) => updateFlow(flowId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flowId: string) => deleteFlow(flowId),
    onMutate: async (flowId) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.status() });
      const prev = queryClient.getQueryData<FlowStatusSnapshot>(
        flowKeys.status(),
      );
      if (prev) {
        queryClient.setQueryData<FlowStatusSnapshot>(flowKeys.status(), {
          ...prev,
          flows: prev.flows.filter((f) => f.id !== flowId),
        });
      }
      return { prev };
    },
    onError: (_err, _flowId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(flowKeys.status(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: flowKeys.status() });
    },
  });
}

export function useSetFlowEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, enabled }: { flowId: string; enabled: boolean }) =>
      setFlowEnabled(flowId, enabled),
    onMutate: async ({ flowId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.status() });
      const prev = queryClient.getQueryData<FlowStatusSnapshot>(
        flowKeys.status(),
      );
      if (prev) {
        queryClient.setQueryData<FlowStatusSnapshot>(flowKeys.status(), {
          ...prev,
          flows: prev.flows.map((f) =>
            f.id === flowId ? { ...f, enabled } : f,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(flowKeys.status(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: flowKeys.status() });
    },
  });
}

export function useStartFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({ flowId, limit }: { flowId: string; limit?: number }) =>
      startFlow(flowId, limit),
    onSuccess: invalidate,
  });
}

export function useConvertFlowToStaticPlaylist() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({ flowId, name }: { flowId: string; name?: string }) =>
      convertFlowToStaticPlaylist(flowId, name),
    onSuccess: invalidate,
  });
}

export function useUpdateSharedPlaylist() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      playlistId,
      payload,
    }: {
      playlistId: string;
      payload: { name?: string; tracks?: SharedPlaylistTrack[] };
    }) => updateSharedPlaylist(playlistId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteSharedPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: string) => deleteSharedPlaylist(playlistId),
    onMutate: async (playlistId) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.status() });
      const prev = queryClient.getQueryData<FlowStatusSnapshot>(
        flowKeys.status(),
      );
      if (prev) {
        queryClient.setQueryData<FlowStatusSnapshot>(flowKeys.status(), {
          ...prev,
          sharedPlaylists: prev.sharedPlaylists.filter(
            (p) => p.id !== playlistId,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(flowKeys.status(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: flowKeys.status() });
    },
  });
}

export function useDeleteSharedPlaylistTrack() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      playlistId,
      jobId,
    }: {
      playlistId: string;
      jobId: string;
    }) => deleteSharedPlaylistTrack(playlistId, jobId),
    onSuccess: invalidate,
  });
}

export function useSetRetryCyclePaused() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      playlistId,
      paused,
    }: {
      playlistId: string;
      paused: boolean;
    }) => setRetryCyclePaused(playlistId, paused),
    onSuccess: invalidate,
  });
}
