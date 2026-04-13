import { api } from "./client";
import type { HealthLiveResponse, HealthResponse } from "@/lib/types/auth";

export function checkServerLive() {
  return api
    .get<HealthLiveResponse>("/health/live", { timeout: 10_000 })
    .then((r) => r.data);
}

export function getServerHealth() {
  return api.get<HealthResponse>("/health").then((r) => r.data);
}
