import type { ErrorBoundaryProps } from "expo-router";
import { ArtistSongsScreen } from "@/components/artist/ArtistSongsScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default ArtistSongsScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load songs" />;
}
