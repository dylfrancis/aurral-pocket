import type { Flow } from "@/lib/types/flow";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function scheduleLabel(flow: Flow): string {
  if (!flow.scheduleDays?.length) return "Manual";
  const days = flow.scheduleDays
    .map((day) => DAY_LABELS[day] ?? "")
    .filter(Boolean);
  return `${days.join(", ")} · ${flow.scheduleTime}`;
}
