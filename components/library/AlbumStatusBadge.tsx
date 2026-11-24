import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui/Chip";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { formatReleaseWait } from "@/lib/album-status";
import type { Album, DownloadStatusValue } from "@/lib/types/library";

type AlbumStatus =
  | "complete"
  | "adding"
  | "searching"
  | "downloading"
  | "moving"
  | "processing"
  | "queued"
  | "unreleased"
  | "blocked"
  | "cancelled"
  | "failed"
  | "monitored"
  | "unmonitored";

const OVERRIDING_STATUSES: ReadonlySet<DownloadStatusValue> = new Set([
  "adding",
  "searching",
  "downloading",
  "moving",
  "processing",
  "queued",
  "unreleased",
  "blocked",
  "cancelled",
  "failed",
]);

function getAlbumStatus(
  album: Album,
  complete: boolean,
  downloadStatus?: DownloadStatusValue,
): AlbumStatus {
  if (complete) return "complete";
  if (downloadStatus && OVERRIDING_STATUSES.has(downloadStatus))
    return downloadStatus as AlbumStatus;
  if (album.monitored) return "monitored";
  return "unmonitored";
}

const statusConfig: Record<
  AlbumStatus,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    variant: "brand" | "subtle" | "error";
  }
> = {
  complete: { label: "Complete", icon: "checkmark-circle", variant: "brand" },
  adding: { label: "Adding...", icon: "sync-outline", variant: "brand" },
  searching: { label: "Searching...", icon: "sync-outline", variant: "brand" },
  downloading: {
    label: "Downloading...",
    icon: "cloud-download-outline",
    variant: "brand",
  },
  moving: { label: "Moving...", icon: "sync-outline", variant: "brand" },
  processing: {
    label: "Processing...",
    icon: "sync-outline",
    variant: "brand",
  },
  queued: { label: "Queued", icon: "time-outline", variant: "subtle" },
  unreleased: { label: "", icon: "calendar-outline", variant: "subtle" },
  blocked: {
    label: "Needs attention",
    icon: "alert-circle-outline",
    variant: "error",
  },
  cancelled: {
    label: "Cancelled",
    icon: "close-circle-outline",
    variant: "subtle",
  },
  failed: { label: "Failed", icon: "alert-circle", variant: "error" },
  monitored: { label: "Monitored", icon: "eye", variant: "subtle" },
  unmonitored: {
    label: "Unmonitored",
    icon: "eye-off-outline",
    variant: "subtle",
  },
};

type AlbumStatusBadgeProps = {
  album: Album;
  /** Every track the album page lists has a file. */
  complete: boolean;
  downloadStatus?: DownloadStatusValue;
};

export function AlbumStatusBadge({
  album,
  complete,
  downloadStatus,
}: AlbumStatusBadgeProps) {
  useDateTimeFormat();
  const status = getAlbumStatus(album, complete, downloadStatus);
  const config = statusConfig[status];
  const label =
    status === "unreleased"
      ? formatReleaseWait(album.releaseDate)
      : config.label;

  return <Chip label={label} icon={config.icon} variant={config.variant} />;
}
