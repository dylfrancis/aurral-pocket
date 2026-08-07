import type { ErrorBoundaryProps } from "expo-router";
import { BrowseArtistDetailScreen } from "@/components/artist/BrowseArtistDetailScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default BrowseArtistDetailScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <RouteErrorBoundary
      {...props}
      message="Failed to load artist"
      notFoundMessage="Artist not found"
    />
  );
}
