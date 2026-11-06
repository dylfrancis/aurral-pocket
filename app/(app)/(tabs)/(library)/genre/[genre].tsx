import { useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { LibraryAlbumsScreen } from "@/components/library/LibraryAlbumsScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default function GenreDetailRoute() {
  const { genre } = useLocalSearchParams<{ genre: string }>();
  return <LibraryAlbumsScreen genre={genre} />;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load albums" />;
}
