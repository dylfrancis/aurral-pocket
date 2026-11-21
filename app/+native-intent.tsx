import { isOidcAppRedirectUrl } from "@/lib/oidc";

/**
 * On Android the auth browser returns from SSO through a deep link, which the
 * router would otherwise open as an unmatched `/sso` screen. `expo-web-browser`
 * reads the same link for the sign-in.
 */
export function redirectSystemPath({ path }: { path: string }) {
  return isOidcAppRedirectUrl(path) ? null : path;
}
