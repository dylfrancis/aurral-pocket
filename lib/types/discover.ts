export type BlockedArtist = {
  mbid: string | null;
  name: string | null;
};

export type Blocklist = {
  artists: BlockedArtist[];
  tags: string[];
};

export type UpdateBlocklistResponse = {
  success: boolean;
  blocklist: Blocklist;
};
