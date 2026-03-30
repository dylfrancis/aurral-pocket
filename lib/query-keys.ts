export const authKeys = {
  me: (serverUrl: string) => ['auth', 'me', serverUrl] as const,
};
