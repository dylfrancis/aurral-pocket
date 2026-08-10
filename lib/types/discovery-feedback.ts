/**
 * Discovery feedback is Aurral's single store for "shape my recommendations"
 * signals. The blocklist is the `block_artist` slice of it — there is no longer
 * a dedicated /discover/blocklist endpoint.
 */
export type DiscoveryFeedbackAction =
  | "more_like_this"
  | "less_like_this"
  | "block_artist";

export type DiscoveryFeedbackEntry = {
  id: string | null;
  artistId: string | null;
  artistName: string | null;
  action: DiscoveryFeedbackAction | null;
  sourceContext: string | null;
  tagContext?: string[];
  seedContext?: string[];
  createdAt?: string | null;
  /** Server-side expiry. Entries past it are ignored rather than deleted. */
  expiresAt?: string | null;
};

export type DiscoveryFeedbackInput = {
  action: DiscoveryFeedbackAction;
  artistId?: string | null;
  artistName?: string | null;
  sourceContext?: string;
};

/** A blocked artist, narrowed from a feedback entry that has an id to delete. */
export type BlockedArtist = {
  id: string;
  artistId: string | null;
  name: string;
};
