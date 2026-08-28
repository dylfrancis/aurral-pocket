import { api } from "./client";
import { setDateTimeFormat } from "@/lib/date-time";
import type { HealthLiveResponse, HealthResponse } from "@/lib/types/auth";

export function checkServerLive() {
  return api
    .get<HealthLiveResponse>("/health/live", { timeout: 10_000 })
    .then((r) => r.data);
}

/**
 * Bootstrap payload for the configured server. Every response carries the
 * server's date and time setting, so adopt it here rather than in each caller.
 */
export function getServerHealth() {
  return api.get<HealthResponse>("/health").then((r) => {
    setDateTimeFormat(r.data.dateTimeFormat);
    return r.data;
  });
}
