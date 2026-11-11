import { useMemo, useState } from "react";
import {
  compareActivityItems,
  getActivityStatus,
  getActivityStatusOptions,
  matchesActivityType,
  matchesActivityView,
  type ActivityStatus,
  type ActivityTypeFilter,
  type ActivityView,
} from "@/lib/activity-views";
import type { ActivityItem } from "@/lib/types/activity";

/**
 * The filters are per-tab state, so filtering History leaves Queue alone.
 * Status counts follow the type filter, so a count matches what choosing it
 * shows.
 */
export function useActivityFilter(
  items: ActivityItem[] | undefined,
  view: ActivityView,
) {
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | null>(null);

  const viewItems = useMemo(
    () =>
      (items ?? [])
        .filter((item) => matchesActivityView(item, view))
        .filter((item) => matchesActivityType(item, typeFilter)),
    [items, view, typeFilter],
  );

  const statusOptions = useMemo(
    () => getActivityStatusOptions(view, viewItems, statusFilter),
    [view, viewItems, statusFilter],
  );

  const visible = useMemo(
    () =>
      (statusFilter
        ? viewItems.filter((item) => getActivityStatus(item) === statusFilter)
        : [...viewItems]
      ).sort(compareActivityItems),
    [viewItems, statusFilter],
  );

  return {
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    statusOptions,
    allCount: viewItems.length,
    visible,
  };
}
