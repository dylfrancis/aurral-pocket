import { useAuth } from '@/contexts/auth-context';

type Permission =
  | 'addArtist'
  | 'addAlbum'
  | 'changeMonitoring'
  | 'deleteArtist'
  | 'deleteAlbum'
  | 'accessSettings'
  | 'accessFlow';

export function useHasPermission() {
  const { user } = useAuth();

  return (perm: Permission): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return !!user.permissions?.[perm];
  };
}
