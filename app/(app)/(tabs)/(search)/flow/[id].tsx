import type { ErrorBoundaryProps } from "expo-router";
import { FlowDetailScreen } from "@/components/flow/FlowDetailScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default FlowDetailScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load flow" />;
}
