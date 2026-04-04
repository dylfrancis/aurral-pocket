import { useEffect, useState } from 'react';

/**
 * Returns a human-readable label ("Face ID", "Touch ID", "Biometrics") if
 * biometric hardware is available and enrolled, or null if not.
 *
 * The expo-local-authentication module is loaded lazily so the app doesn't
 * crash when the native module isn't linked (e.g. Expo Go).
 */
export function useBiometricAvailability(): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const LA = await import('expo-local-authentication');
        const compatible = await LA.hasHardwareAsync();
        if (!compatible) return;
        const enrolled = await LA.isEnrolledAsync();
        if (!enrolled) return;
        const types = await LA.supportedAuthenticationTypesAsync();
        if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) {
          setLabel('Face ID');
        } else if (types.includes(LA.AuthenticationType.FINGERPRINT)) {
          setLabel('Touch ID');
        } else {
          setLabel('Biometrics');
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
  promptMessage = 'Authenticate to continue',
): Promise<boolean> {
  try {
    const LA = await import('expo-local-authentication');
    const result = await LA.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
