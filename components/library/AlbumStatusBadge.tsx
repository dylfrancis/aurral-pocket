import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/components/ui/Chip';
import type { Album, DownloadStatusValue } from '@/lib/types/library';

type AlbumStatus =
  | 'complete'
  | 'adding'
  | 'searching'
  | 'downloading'
  | 'moving'
  | 'processing'
  | 'failed'
  | 'partial'
  | 'monitored'
  | 'unmonitored';

const ACTIVE_STATUSES: DownloadStatusValue[] = [
  'adding',
  'searching',
  'downloading',
  'moving',
  'processing',
];

function getAlbumStatus(
  album: Album,
  downloadStatus?: DownloadStatusValue,
): AlbumStatus {
  const percent = album.statistics.percentOfTracks;
  if (percent >= 100 || album.statistics.sizeOnDisk > 0) return 'complete';
  if (downloadStatus && ACTIVE_STATUSES.includes(downloadStatus))
    return downloadStatus as AlbumStatus;
  if (downloadStatus === 'failed') return 'failed';
  if (percent > 0) return 'partial';
  if (album.monitored) return 'monitored';
  return 'unmonitored';
}

const statusConfig: Record<
  AlbumStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; variant: 'brand' | 'subtle' | 'error' }
> = {
  complete: { label: 'Complete', icon: 'checkmark-circle', variant: 'brand' },
  adding: { label: 'Adding...', icon: 'sync-outline', variant: 'brand' },
  searching: { label: 'Searching...', icon: 'sync-outline', variant: 'brand' },
  downloading: { label: 'Downloading...', icon: 'cloud-download-outline', variant: 'brand' },
  moving: { label: 'Moving...', icon: 'sync-outline', variant: 'brand' },
  processing: { label: 'Processing...', icon: 'sync-outline', variant: 'brand' },
  failed: { label: 'Failed', icon: 'alert-circle', variant: 'error' },
  partial: { label: 'Downloading', icon: 'cloud-download-outline', variant: 'brand' },
  monitored: { label: 'Monitored', icon: 'eye', variant: 'subtle' },
  unmonitored: { label: 'Unmonitored', icon: 'eye-off-outline', variant: 'subtle' },
};

type AlbumStatusBadgeProps = {
  album: Album;
  downloadStatus?: DownloadStatusValue;
};

export function AlbumStatusBadge({ album, downloadStatus }: AlbumStatusBadgeProps) {
  const status = getAlbumStatus(album, downloadStatus);
  const config = statusConfig[status];
  const label = status === 'partial'
    ? `${Math.round(album.statistics.percentOfTracks)}%`
    : config.label;

  return <Chip label={label} icon={config.icon} variant={config.variant} />;
}
