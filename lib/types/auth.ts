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
  // Optional: present on Aurral 2.2.0 and later. An older or forked server
  // omits both, which reads as "no OIDC" and leaves the password form alone.
  oidcEnabled?: boolean;
  oidcLogoutUrl?: string | null;
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

/** Body of `POST /api/auth/oidc/exchange`, stored like any other session. */
export type OidcSession = LoginResponse;

export type MeResponse = {
  user: User;
  expiresAt: number;
};
