import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/components/ui/Chip';
import type { Album } from '@/lib/types/library';

type AlbumStatus = 'complete' | 'monitored' | 'unmonitored';

function getAlbumStatus(album: Album): AlbumStatus {
  const percent = album.statistics.percentOfTracks;
  if (percent >= 100 || album.statistics.sizeOnDisk > 0) return 'complete';
  if (album.monitored) return 'monitored';
  return 'unmonitored';
}

const statusConfig: Record<
  AlbumStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; variant: 'brand' | 'subtle' }
> = {
  complete: { label: 'Complete', icon: 'checkmark-circle', variant: 'brand' },
  monitored: { label: 'Monitored', icon: 'eye', variant: 'subtle' },
  unmonitored: { label: 'Unmonitored', icon: 'eye-off-outline', variant: 'subtle' },
};

type AlbumStatusBadgeProps = {
  album: Album;
};

export function AlbumStatusBadge({ album }: AlbumStatusBadgeProps) {
  const status = getAlbumStatus(album);
  const config = statusConfig[status];

  return <Chip label={config.label} icon={config.icon} variant={config.variant} />;
}
