import { ActivityList } from "@/components/activity/ActivityList";
import { ActivityErrorBoundary } from "@/components/activity/ActivityErrorBoundary";

export default function QueueScreen() {
  return <ActivityList view="queue" />;
}

export { ActivityErrorBoundary as ErrorBoundary };
