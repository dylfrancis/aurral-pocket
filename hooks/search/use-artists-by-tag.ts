import { useQuery } from "@tanstack/react-query";
import { getArtistsByTag } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";
import type { TagSearchScope } from "@/lib/types/search";

export function useArtistsByTag(
  tag: string | null,
  scope: TagSearchScope = "all",
) {
  return useQuery({
    queryKey: searchKeys.artistsByTag(tag ?? "", scope),
    queryFn: () => getArtistsByTag(tag ?? "", scope),
    enabled: !!tag,
    staleTime: 5 * 60 * 1000,
  });
}
