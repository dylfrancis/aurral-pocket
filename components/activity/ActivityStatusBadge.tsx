import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui/Chip";
import { formatReleaseWait } from "@/lib/album-status";
import type { DownloadStatusEntry } from "@/lib/types/library";
import { isAlbumRequest, type ActivityItem } from "@/lib/types/activity";

type BadgeConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "brand" | "subtle" | "error";
};

function resolveBadge(
  item: ActivityItem,
  downloadEntry: DownloadStatusEntry | undefined,
): BadgeConfig {
  const downloadStatus = downloadEntry?.status;
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
    case "complete":
      return {
        label: "Available",
        icon: "checkmark-circle",
        variant: "brand",
      };
    case "queued":
      return { label: "Queued", icon: "time-outline", variant: "subtle" };
    case "unreleased":
      return {
        label: formatReleaseWait(downloadEntry?.releaseDate),
        icon: "calendar-outline",
        variant: "subtle",
      };
    case "blocked":
      return {
        label: "Needs attention",
        icon: "alert-circle-outline",
        variant: "error",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        icon: "close-circle-outline",
        variant: "subtle",
      };
    case "partial":
      return {
        label: "Partially available",
        icon: "checkmark-circle-outline",
        variant: "subtle",
      };
    // Aurral marks its request completed at once, so the row's own label
    // would read as done for an album with nothing on disk or queued.
    case "missing":
      return {
        label: "Missing",
        icon: "alert-circle-outline",
        variant: "subtle",
      };
  }

  if (downloadStatus === "failed" || item.status === "failed") {
    return { label: "Failed", icon: "alert-circle", variant: "error" };
  }

  if (item.status === "cancelled") {
    return {
      label: (!isAlbumRequest(item) && item.statusLabel) || "Cancelled",
      icon: "close-circle-outline",
      variant: "subtle",
    };
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
  downloadEntry?: DownloadStatusEntry;
};

export function ActivityStatusBadge({
  item,
  downloadEntry,
}: ActivityStatusBadgeProps) {
  const { label, icon, variant } = resolveBadge(item, downloadEntry);
  return <Chip label={label} icon={icon} variant={variant} />;
}
