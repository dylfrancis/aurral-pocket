import { FieldGroup, Host, Icon } from "@expo/ui";
import { useRouter } from "expo-router";
import AccountCircle from "@expo/material-symbols/account_circle.xml";
import Contrast from "@expo/material-symbols/contrast.xml";
import Dns from "@expo/material-symbols/dns.xml";
import Info from "@expo/material-symbols/info.xml";
import Logout from "@expo/material-symbols/logout.xml";
import { useSettingsRow } from "@/components/settings/SettingsRows";
import { useAuth } from "@/contexts/auth-context";
import { useThemePreference } from "@/contexts/theme-context";
import { useLogout } from "@/hooks/auth/use-logout";
import { useSession } from "@/hooks/auth/use-session";
import { setAuthToken } from "@/lib/api/client";
import { hostOf } from "@/lib/url";
import { APPEARANCE_LABELS } from "@/components/settings/appearance";

const ICONS = {
  account: Icon.select({ ios: "person.crop.circle", android: AccountCircle }),
  appearance: Icon.select({ ios: "circle.lefthalf.filled", android: Contrast }),
  server: Icon.select({ ios: "server.rack", android: Dns }),
  about: Icon.select({ ios: "info.circle", android: Info }),
  signOut: Icon.select({
    ios: "rectangle.portrait.and.arrow.right",
    android: Logout,
  }),
};

export function SettingsScreen() {
  const router = useRouter();
  const { user, serverUrl } = useAuth();
  const { preference } = useThemePreference();
  const logout = useLogout();
  const row = useSettingsRow();
  // Reads /auth/me, which renews the stored session expiry.
  useSession();

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          {row({
            icon: ICONS.account,
            label: "Account",
            value: user?.username,
            opensPage: true,
            onPress: () => router.push("/settings/account"),
          })}
          {row({
            icon: ICONS.appearance,
            label: "Appearance",
            value: APPEARANCE_LABELS[preference],
            opensPage: true,
            onPress: () => router.push("/settings/appearance"),
          })}
        </FieldGroup.Section>
        <FieldGroup.Section>
          {row({
            icon: ICONS.server,
            label: "Server",
            value: serverUrl ? hostOf(serverUrl) : null,
            opensPage: true,
            onPress: () => router.push("/settings/server"),
          })}
          {row({
            icon: ICONS.about,
            label: "About",
            opensPage: true,
            onPress: () => router.push("/settings/about"),
          })}
        </FieldGroup.Section>
        <FieldGroup.Section>
          {row({
            icon: ICONS.signOut,
            label: logout.isPending ? "Signing Out…" : "Sign Out",
            destructive: true,
            disabled: logout.isPending,
            onPress: () => logout.mutate(),
          })}
          {__DEV__
            ? row({
                label: "Invalidate Session (debug)",
                onPress: () => setAuthToken("invalid-token-for-testing"),
              })
            : null}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
