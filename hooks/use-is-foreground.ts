import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Only the background counts as leaving. iOS reports inactive while Control
 * Center or the app switcher covers the app, and reacting to that would churn.
 */
export function useIsForeground(): boolean {
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state !== "background"),
    );
    return () => subscription.remove();
  }, []);
  return foreground;
}
