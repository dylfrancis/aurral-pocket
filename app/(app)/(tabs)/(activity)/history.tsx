import { ActivityList } from "@/components/activity/ActivityList";
import { ActivityErrorBoundary } from "@/components/activity/ActivityErrorBoundary";

export default function HistoryScreen() {
  return <ActivityList view="history" />;
}

export { ActivityErrorBoundary as ErrorBoundary };
