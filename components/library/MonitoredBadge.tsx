import { Chip } from '@/components/ui/Chip';

type MonitoredBadgeProps = {
  monitored: boolean;
};

export function MonitoredBadge({ monitored }: MonitoredBadgeProps) {
  return (
    <Chip
      label={monitored ? 'Monitored' : 'Unmonitored'}
      icon={monitored ? 'eye' : 'eye-off-outline'}
      variant={monitored ? 'brand' : 'subtle'}
    />
  );
}
