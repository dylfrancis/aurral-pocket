import { useMutation } from "@tanstack/react-query";
import { changeMyPassword } from "@/lib/api/me";
import type { ChangePasswordPayload } from "@/lib/types/me";

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changeMyPassword(payload),
  });
}
