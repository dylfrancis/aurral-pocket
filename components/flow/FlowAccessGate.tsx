import type { ReactNode } from "react";
import { EmptyState } from "@/components/library/EmptyState";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { useHasPermission } from "@/hooks/auth/use-has-permission";

/**
 * Flow and playlist screens answer 403 without `accessPlaylists`, and a tab's root
 * or a deep link still lands on them. Callers fetch inside `children`, because a
 * suspense query has no `enabled` option: not rendering it is the only way not
 * to fire it.
 */
export function FlowAccessGate({
  message,
  children,
}: {
  message: string;
  children: ReactNode;
}) {
  const hasPermission = useHasPermission();

  if (!hasPermission("accessPlaylists")) {
    return (
      <ScreenCenter>
        <EmptyState icon="lock-closed-outline" message={message} />
      </ScreenCenter>
    );
  }

  return children;
}
