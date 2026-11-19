import { useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { LibraryAlbumsScreen } from "@/components/library/LibraryAlbumsScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default function LibraryAlbumsRoute() {
  const { sort } = useLocalSearchParams<{ sort?: string }>();
  return <LibraryAlbumsScreen openedSort={sort} />;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load albums" />;
}
