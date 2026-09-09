import type { ErrorBoundaryProps } from "expo-router";
import { AlbumDetailScreen } from "@/components/library/AlbumDetailScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default AlbumDetailScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load album" />;
}
