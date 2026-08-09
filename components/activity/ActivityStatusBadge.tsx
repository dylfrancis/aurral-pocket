import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui/Chip";
import type { DownloadStatusValue } from "@/lib/types/library";
import { isAlbumRequest, type ActivityItem } from "@/lib/types/activity";

type BadgeConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "brand" | "subtle" | "error";
};

function resolveBadge(
  item: ActivityItem,
  downloadStatus: DownloadStatusValue | undefined,
): BadgeConfig {
  switch (downloadStatus) {
    case "adding":
      return { label: "Adding...", icon: "sync-outline", variant: "brand" };
    case "searching":
      return { label: "Searching...", icon: "sync-outline", variant: "brand" };
    case "downloading":
      return {
        label: "Downloading...",
        icon: "cloud-download-outline",
        variant: "brand",
      };
    case "moving":
      return { label: "Moving...", icon: "sync-outline", variant: "brand" };
    case "processing":
      return { label: "Processing", icon: "sync-outline", variant: "brand" };
    case "added":
    case "available":
      return {
        label: "Available",
        icon: "checkmark-circle",
        variant: "brand",
      };
  }

  if (downloadStatus === "failed" || item.status === "failed") {
    return { label: "Failed", icon: "alert-circle", variant: "error" };
  }

  // History entries ship a server-rendered label ("Added", "Reused", ...).
  // Prefer it over anything Pocket would invent for the same status.
  if (!isAlbumRequest(item) && item.statusLabel) {
    const settled = item.status === "completed";
    return {
      label: item.statusLabel,
      icon: settled ? "checkmark-circle" : "sync-outline",
      variant: settled ? "brand" : "subtle",
    };
  }

  if (item.status === "available" || item.status === "completed") {
    return { label: "Available", icon: "checkmark-circle", variant: "brand" };
  }
  if (item.status === "processing" || item.status === "pending") {
    return { label: "Processing", icon: "sync-outline", variant: "brand" };
  }
  if (item.status === "blocked") {
    return { label: "Blocked", icon: "hand-left-outline", variant: "error" };
  }
  return { label: "Requested", icon: "time-outline", variant: "subtle" };
}

type ActivityStatusBadgeProps = {
  item: ActivityItem;
  downloadStatus?: DownloadStatusValue;
};

export function ActivityStatusBadge({
  item,
  downloadStatus,
}: ActivityStatusBadgeProps) {
  const { label, icon, variant } = resolveBadge(item, downloadStatus);
  return <Chip label={label} icon={icon} variant={variant} />;
}
