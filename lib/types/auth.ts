export type User = {
  id: number;
  username: string;
  role: "admin" | "user";
  permissions: {
    addArtist?: boolean;
    addAlbum?: boolean;
    changeMonitoring?: boolean;
    deleteArtist?: boolean;
    deleteAlbum?: boolean;
    accessSettings?: boolean;
    accessFlow?: boolean;
  };
};

export type HealthLiveResponse = {
  status: string;
};

export type HealthResponse = {
  status: string;
  authRequired: boolean;
  onboardingRequired: boolean;
  timestamp: string;
  // Optional: present on Aurral 2.0.4 and 2.1.0, but treat it as absent-able so
  // an older or forked server without it degrades to "unknown" instead of "".
  appVersion?: string;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  expiresAt: number;
  user: User;
};

export type MeResponse = {
  user: User;
  expiresAt: number;
};
