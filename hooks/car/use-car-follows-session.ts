import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { refreshCar } from "@/hooks/car/car-screens";

/**
 * Reads the car's lists again for a new account or token, since covers carry
 * the token. Sign-out refreshes them through onSessionCleared instead.
 */
export function useCarFollowsSession() {
  const { user, token } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (token) refreshCar();
  }, [userId, token]);
}
