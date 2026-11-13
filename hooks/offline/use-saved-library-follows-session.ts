import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getMe } from "@/lib/api/auth";
import {
  onSaveRefused,
  resumeSaving,
  setSavedLibraryUser,
} from "@/lib/offline/saved-library";

/**
 * Shows the signed-in account its own saves and keeps them downloading across
 * session changes. The layout this runs in unmounts at sign-out, which hides
 * the saves until the account is back.
 */
export function useSavedLibraryFollowsSession() {
  const { token, user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (userId === undefined) return;
    setSavedLibraryUser(userId);
    return () => setSavedLibraryUser(null);
  }, [userId]);

  // A new token builds fresh URLs for whatever is still to save.
  useEffect(() => {
    if (token) resumeSaving();
  }, [token]);

  // A refused file means the session may be gone. Asking the server starts
  // the usual re-auth when it is; when it isn't, the save goes on.
  useEffect(
    () =>
      onSaveRefused(() => {
        getMe()
          .then(() => resumeSaving())
          .catch(() => {});
      }),
    [],
  );
}
