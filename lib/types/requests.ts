export type RequestStatus = "processing" | "available" | "failed";

export type Request = {
  id: string;
  type: "album";
  albumId: string | null;
  albumMbid: string | null;
  albumName: string;
  artistId: string | null;
  artistMbid: string | null;
  artistName: string;
  status: RequestStatus;
  requestedAt: string;
  mbid: string | null;
  name: string;
  image: string | null;
  inQueue: boolean;
};
