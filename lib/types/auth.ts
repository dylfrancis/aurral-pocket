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
