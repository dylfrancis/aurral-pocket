import type { ErrorBoundaryProps } from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { ApiError } from "@/lib/api/client";

type RouteErrorBoundaryProps = ErrorBoundaryProps & {
  /** Shown for any failure that is not a 404. */
  message: string;
  /**
   * Shown instead of `message` when the request 404'd. A 404 is not worth a
   * retry button — the resource is absent, not unreachable. Omit to treat 404s
   * like any other failure.
   */
  notFoundMessage?: string;
};

/**
 * Body for a route's `ErrorBoundary` export. Expo Router wraps every route in
 * a boundary, but only if that route's file exports one — a file that merely
 * re-exports a screen component has nowhere to put it, so the error escapes to
 * the root layout and takes the whole app down with it.
 *
 * Resetting the React Query error boundary alongside `retry()` matters: without
 * it, the query stays in its error state and the remounted screen throws again
 * immediately.
 */
export function RouteErrorBoundary({
  error,
  retry,
  message,
  notFoundMessage,
}: RouteErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  if (notFoundMessage && error instanceof ApiError && error.status === 404) {
    return (
      <ScreenCenter>
        <EmptyState icon="alert-circle-outline" message={notFoundMessage} />
      </ScreenCenter>
    );
  }

  return (
    <ScreenCenter>
      <EmptyState
        icon="cloud-offline-outline"
        message={message}
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
  );
}
