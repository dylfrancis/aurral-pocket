import type { ErrorBoundaryProps } from "expo-router";
import { ReleasesGridScreen } from "@/components/artist/ReleasesGridScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default ReleasesGridScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load releases" />;
}
