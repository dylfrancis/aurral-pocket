import { Chip } from "@/components/ui/Chip";
import type { FlowJobStatus } from "@/lib/types/flow";

const CONFIG: Record<
  FlowJobStatus,
  { label: string; variant: "brand" | "subtle" | "error" }
> = {
  pending: { label: "Queued", variant: "subtle" },
  downloading: { label: "Downloading", variant: "brand" },
  done: { label: "Ready", variant: "brand" },
  failed: { label: "Failed", variant: "error" },
};

type Props = { status: FlowJobStatus };

export function StatusBadge({ status }: Props) {
  const { label, variant } = CONFIG[status];
  return <Chip label={label} variant={variant} />;
}
