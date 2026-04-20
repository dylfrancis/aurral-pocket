import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Returns a human-readable label for the strongest enrolled biometric
 * ("Face ID" / "Touch ID" on iOS, "Face Unlock" / "Fingerprint" on Android,
 * or "Biometrics" as a fallback), or null if hardware is absent or unenrolled.
 *
 * The expo-local-authentication module is loaded lazily so the app doesn't
 * crash when the native module isn't linked (e.g. Expo Go).
 */
export function useBiometricAvailability(): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const LA = await import("expo-local-authentication");
        const compatible = await LA.hasHardwareAsync();
        if (!compatible) return;
        const enrolled = await LA.isEnrolledAsync();
        if (!enrolled) return;
        const types = await LA.supportedAuthenticationTypesAsync();
        const hasFace = types.includes(
          LA.AuthenticationType.FACIAL_RECOGNITION,
        );
        const hasFingerprint = types.includes(
          LA.AuthenticationType.FINGERPRINT,
        );
        if (Platform.OS === "ios") {
          if (hasFace) setLabel("Face ID");
          else if (hasFingerprint) setLabel("Touch ID");
          else setLabel("Biometrics");
        } else {
          if (hasFingerprint) setLabel("Fingerprint");
          else if (hasFace) setLabel("Face Unlock");
          else setLabel("Biometrics");
        }
      } catch {
        // Native module not available — biometrics disabled
      }
    })();
  }, []);

  return label;
}

/**
 * Prompt the user for biometric authentication. Returns true on success.
 * Returns false if biometrics unavailable or user cancels.
 */
export async function authenticateWithBiometrics(
  promptMessage = "Authenticate to continue",
): Promise<boolean> {
  try {
    const LA = await import("expo-local-authentication");
    const result = await LA.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use password",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
