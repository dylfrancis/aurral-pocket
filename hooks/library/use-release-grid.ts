import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useAlbumsWithTypes } from '@/hooks/library/use-albums-with-types';
import { ALBUM_SORT_OPTIONS, type AlbumSortMode } from '@/components/library/AlbumSortPicker';
import { stripArticle } from '@/lib/strings';
import type { Album, PrimaryReleaseType, ReleaseGroup } from '@/lib/types/library';

type ReleaseGridConfig<T> = {
  variant: 'albums' | 'releases';
  getDate: (item: T) => string | null;
  getName: (item: T) => string;
  supportsMissing: boolean;
  isMissing?: (item: T) => boolean;
};

function sortItems<T>(
  items: T[],
  mode: AlbumSortMode,
  config: ReleaseGridConfig<T>,
): T[] {
  const list = items.slice();
  switch (mode) {
    case 'date-desc':
      return list.sort((a, b) => {
        if (!config.getDate(a)) return 1;
        if (!config.getDate(b)) return -1;
        return new Date(config.getDate(b)!).getTime() - new Date(config.getDate(a)!).getTime();
      });
    case 'date-asc':
      return list.sort((a, b) => {
        if (!config.getDate(a)) return 1;
        if (!config.getDate(b)) return -1;
        return new Date(config.getDate(a)!).getTime() - new Date(config.getDate(b)!).getTime();
      });
    case 'name-asc':
      return list.sort((a, b) => stripArticle(config.getName(a)).localeCompare(stripArticle(config.getName(b))));
    case 'name-desc':
      return list.sort((a, b) => stripArticle(config.getName(b)).localeCompare(stripArticle(config.getName(a))));
    case 'missing':
      if (!config.isMissing) return list;
      return list.sort((a, b) => {
        const aMissing = config.isMissing!(a);
        const bMissing = config.isMissing!(b);
        if (aMissing !== bMissing) return aMissing ? -1 : 1;
        if (!config.getDate(a)) return 1;
        if (!config.getDate(b)) return -1;
        return new Date(config.getDate(b)!).getTime() - new Date(config.getDate(a)!).getTime();
      });
  }
}

export function useReleaseGrid<T>(config: ReleaseGridConfig<T>) {
  const { artistId, artistMbid, albumType, artistName } = useLocalSearchParams<{
    artistId: string;
    artistMbid: string;
    albumType: string;
    title: string;
    artistName: string;
  }>();

  const { data: rawAlbums, isLoading: albumsLoading, refetch } = useLibraryAlbums(artistId);
  const { albums: typedAlbums, otherReleases, isLoadingTypes } = useAlbumsWithTypes(artistMbid, rawAlbums);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const [sortMode, setRawSortMode] = useState<AlbumSortMode>('date-desc');
  const setSortMode = useCallback((mode: AlbumSortMode) => {
    setRawSortMode(mode);
  }, []);

  const sortOptions = useMemo(
    () => config.supportsMissing ? ALBUM_SORT_OPTIONS : ALBUM_SORT_OPTIONS.filter((o) => o.key !== 'missing'),
    [config.supportsMissing],
  );

  const sourceItems = useMemo(() => {
    if (config.variant === 'albums') {
      return (typedAlbums?.filter((a) => a.albumType === (albumType as PrimaryReleaseType)) ?? []) as T[];
    }
    return (otherReleases?.filter((rg) => rg['primary-type'] === (albumType as PrimaryReleaseType)) ?? []) as T[];
  }, [config.variant, typedAlbums, otherReleases, albumType]);

  const items = useMemo(
    () => sortItems(sourceItems, sortMode, config),
    [sourceItems, sortMode, config],
  );

  const isLoading = config.variant === 'albums'
    ? albumsLoading
    : albumsLoading || isLoadingTypes;

  return {
    items,
    isLoading,
    refreshing,
    handleRefresh,
    sortMode,
    setSortMode,
    sortOptions,
    artistId,
    artistName: artistName ?? '',
    rawAlbums,
  };
}
