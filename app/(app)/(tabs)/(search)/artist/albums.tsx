import type { ErrorBoundaryProps } from "expo-router";
import { AlbumsGridScreen } from "@/components/artist/AlbumsGridScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default AlbumsGridScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load albums" />;
}
