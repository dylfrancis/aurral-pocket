import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui/Chip";
import type { DownloadStatusValue } from "@/lib/types/library";
import type { Request } from "@/lib/types/requests";

type BadgeConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "brand" | "subtle" | "error";
};

function resolveBadge(
  request: Request,
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
      return {
        label: "Available",
        icon: "checkmark-circle",
        variant: "brand",
      };
  }

  if (downloadStatus === "failed" || request.status === "failed") {
    return { label: "Failed", icon: "alert-circle", variant: "error" };
  }
  if (request.status === "available") {
    return { label: "Available", icon: "checkmark-circle", variant: "brand" };
  }
  if (request.status === "processing") {
    return { label: "Processing", icon: "sync-outline", variant: "brand" };
  }
  return { label: "Requested", icon: "time-outline", variant: "subtle" };
}

type RequestStatusBadgeProps = {
  request: Request;
  downloadStatus?: DownloadStatusValue;
};

export function RequestStatusBadge({
  request,
  downloadStatus,
}: RequestStatusBadgeProps) {
  const { label, icon, variant } = resolveBadge(request, downloadStatus);
  return <Chip label={label} icon={icon} variant={variant} />;
}
