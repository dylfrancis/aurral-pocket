import type { ErrorBoundaryProps } from "expo-router";
import { TopTracksScreen } from "@/components/artist/TopTracksScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default TopTracksScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load top tracks" />;
}
