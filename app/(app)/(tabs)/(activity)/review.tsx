import { ActivityList } from "@/components/activity/ActivityList";
import { ActivityErrorBoundary } from "@/components/activity/ActivityErrorBoundary";

export default function ReviewScreen() {
  return <ActivityList view="review" />;
}

export { ActivityErrorBoundary as ErrorBoundary };
