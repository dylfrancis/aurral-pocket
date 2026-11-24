import { useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { ArtistFavoritesScreen } from "@/components/library/FavoritesScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default function ArtistFavoritesRoute() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  return <ArtistFavoritesScreen artistId={artistId} />;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load favorites" />;
}
