import { useSuspenseQuery } from "@tanstack/react-query";
import { getCanonicalGenres } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Caller must be inside a Suspense + ErrorBoundary (Expo Router wraps every
 * route automatically), and inside the `(app)` route group (auth is guaranteed
 * there).
 */
export function useLibraryGenres() {
  return useSuspenseQuery({
    queryKey: libraryKeys.genres(),
    queryFn: getCanonicalGenres,
  });
}
