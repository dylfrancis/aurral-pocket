import { api } from "./client";
import type {
  DiscoveryFeedbackEntry,
  DiscoveryFeedbackInput,
} from "@/lib/types/discovery-feedback";

type FeedbackListResponse = {
  feedback?: DiscoveryFeedbackEntry[];
};

/**
 * The list arrives wrapped as `{ feedback: [...] }` rather than a bare array,
 * so unwrap it here and keep every caller working with the entries.
 */
export async function getDiscoveryFeedback() {
  const r = await api.get<FeedbackListResponse>("/discover/feedback");
  const entries = r.data?.feedback;
  return Array.isArray(entries) ? entries : [];
}

type FeedbackMutationResponse = {
  success?: boolean;
  feedback?: DiscoveryFeedbackEntry;
  feedbackList?: DiscoveryFeedbackEntry[];
};

export async function addDiscoveryFeedback(input: DiscoveryFeedbackInput) {
  const r = await api.post<FeedbackMutationResponse>(
    "/discover/feedback",
    input,
  );
  return r.data;
}

export async function deleteDiscoveryFeedback(id: string) {
  const r = await api.delete<FeedbackMutationResponse>(
    `/discover/feedback/${encodeURIComponent(id)}`,
  );
  return r.data;
}
