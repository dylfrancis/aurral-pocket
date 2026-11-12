import type { ListenHistorySettings } from "@/lib/types/me";
import type {
  ScrobbleConnection,
  ScrobbleProvider,
} from "@/lib/types/scrobbling";

export const LISTENING_SERVICES: readonly ScrobbleProvider[] = [
  "lastfm",
  "listenbrainz",
  "koito",
];

export const SERVICE_LABELS: Record<ScrobbleProvider, string> = {
  lastfm: "Last.fm",
  listenbrainz: "ListenBrainz",
  koito: "Koito",
};

export function isListeningService(value: unknown): value is ScrobbleProvider {
  return LISTENING_SERVICES.includes(value as ScrobbleProvider);
}

/** What a service is used for, the way the web's Listening list puts it. */
export function serviceSummary(
  history: string | null,
  scrobbling: ScrobbleConnection | undefined,
): string {
  const parts = [
    history ? "history" : null,
    scrobbling?.connected ? "scrobbling" : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) return "Not set up";
  const joined = parts.join(", ");
  return joined[0].toUpperCase() + joined.slice(1);
}

export function connectedLabel(connection: ScrobbleConnection): string {
  return connection.displayName
    ? `Connected as ${connection.displayName}`
    : "Connected";
}

export function historyValue(
  history: ListenHistorySettings | undefined,
  service: ScrobbleProvider,
): string {
  return history?.[service] ?? "";
}
