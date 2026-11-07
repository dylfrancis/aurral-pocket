import { useMutation } from "@tanstack/react-query";
import { reauth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { changeMyPassword } from "@/lib/api/me";
import type { ChangePasswordPayload } from "@/lib/types/me";

/**
 * The server only changes a password from a session that signed in recently,
 * and the form already holds the password that proves it.
 *
 * An SSO-only account has no password to confirm, so the change goes ahead on
 * its own: a recent session can set a first password, and an older one gets
 * `reauth_required` back. That is why the error is left for the form to explain.
 */
async function confirmCurrentPassword(currentPassword: string) {
  try {
    await reauth(currentPassword);
  } catch (error) {
    if (!(error instanceof ApiError && error.isNoLocalPassword)) throw error;
  }
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      await confirmCurrentPassword(payload.currentPassword);
      return changeMyPassword(payload);
    },
  });
}
