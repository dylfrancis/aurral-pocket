import { useSuspenseQuery } from "@tanstack/react-query";
import { getCanonicalGenres } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/** Has no auth guard, so call it only inside the `(app)` route group. */
export function useLibraryGenres() {
  return useSuspenseQuery({
    queryKey: libraryKeys.genres(),
    queryFn: getCanonicalGenres,
  });
}
