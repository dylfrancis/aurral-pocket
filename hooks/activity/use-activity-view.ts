import { useMemo, useState } from "react";
import {
  compareActivityItems,
  matchesActivityType,
  matchesActivityView,
  type ActivityTypeFilter,
  type ActivityView,
} from "@/lib/activity-views";
import type { ActivityItem } from "@/lib/types/activity";

/**
 * Narrows the feed to one view. The view itself comes from the route, so this
 * only owns the secondary type filter — which is deliberately per-tab state,
 * letting you filter History without disturbing Queue.
 */
export function useActivityFilter(
  items: ActivityItem[] | undefined,
  view: ActivityView,
) {
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("all");

  const visible = useMemo(
    () =>
      (items ?? [])
        .filter((item) => matchesActivityView(item, view))
        .filter((item) => matchesActivityType(item, typeFilter))
        .sort(compareActivityItems),
    [items, view, typeFilter],
  );

  return { typeFilter, setTypeFilter, visible };
}
