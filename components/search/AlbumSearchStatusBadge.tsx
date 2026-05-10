import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui/Chip";
import type { AlbumStatus } from "@/lib/types/search";

const config: Record<
  AlbumStatus,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    variant: "brand" | "subtle" | "error";
  } | null
> = {
  available: { label: "Available", icon: "checkmark-circle", variant: "brand" },
  inLibrary: { label: "In Library", icon: "eye", variant: "brand" },
  searching: { label: "Searching", icon: "sync-outline", variant: "brand" },
  downloading: {
    label: "Downloading",
    icon: "cloud-download-outline",
    variant: "brand",
  },
  processing: { label: "Processing", icon: "sync-outline", variant: "brand" },
  missing: null,
};

type Props = {
  status: AlbumStatus;
};

export function AlbumSearchStatusBadge({ status }: Props) {
  const entry = config[status];
  if (!entry) return null;
  return <Chip label={entry.label} icon={entry.icon} variant={entry.variant} />;
}
