import { api } from "./client";
import { setDateTimeFormat } from "@/lib/date-time";
import type { HealthLiveResponse, HealthResponse } from "@/lib/types/auth";

/**
 * The app contract version pocket is built against. Connect refuses a server
 * on any other, and scripts/check-api-contract.mjs fails when Aurral moves.
 */
export const SUPPORTED_API_VERSION = 1;

export function checkServerLive() {
  return api
    .get<HealthLiveResponse>("/health/live", { timeout: 10_000 })
    .then((r) => r.data);
}

/**
 * Bootstrap payload for the configured server. Every response carries the
 * server's date and time setting, so adopt it here rather than in each caller.
 *
 * Reads `/health/bootstrap`, not `/health`: only bootstrap is part of the app
 * contract, and `/health` adds and drops fields between releases.
 */
export function getServerHealth() {
  return api.get<HealthResponse>("/health/bootstrap").then((r) => {
    setDateTimeFormat(r.data.dateTimeFormat);
    return r.data;
  });
}
