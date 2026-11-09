import { useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { activityJobControls } from "@/lib/track-job-controls";
import type { ActivityItem } from "@/lib/types/activity";

export function useActivityJobControls() {
  const { user } = useAuth();
  const hasAccessFlow = useHasPermission()("accessFlow");
  const userId = user?.id ?? null;

  return useCallback(
    (item: ActivityItem) =>
      activityJobControls(item, { userId, hasAccessFlow }),
    [userId, hasAccessFlow],
  );
}
