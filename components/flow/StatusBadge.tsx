import { Chip } from "@/components/ui/Chip";
import type { FlowJobStatus } from "@/lib/types/flow";

const CONFIG: Record<
  FlowJobStatus,
  { label: string; variant: "brand" | "subtle" | "error" }
> = {
  pending: { label: "Queued", variant: "subtle" },
  downloading: { label: "Downloading", variant: "brand" },
  blocked: { label: "Blocked", variant: "error" },
  done: { label: "Ready", variant: "brand" },
  failed: { label: "Failed", variant: "error" },
};

type Props = { status: FlowJobStatus };

export function StatusBadge({ status }: Props) {
  // The server can grow new statuses ahead of an app update; render them
  // as-is instead of crashing on a missing config entry.
  const { label, variant } = CONFIG[status] ?? {
    label: status,
    variant: "subtle" as const,
  };
  return <Chip label={label} variant={variant} />;
}
