import type { ErrorBoundaryProps } from "expo-router";
import { ReleaseDetailScreen } from "@/components/library/ReleaseDetailScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default ReleaseDetailScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load release" />;
}
