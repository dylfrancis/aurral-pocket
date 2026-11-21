import { redirectSystemPath } from "@/app/+native-intent";

describe("redirectSystemPath", () => {
  it.each([
    "aurralpocket://sso#code=code-123",
    "aurralpocket://sso#error=OIDC%20login%20failed",
  ])("keeps the auth browser's return, %s, off the router", (path) => {
    expect(redirectSystemPath({ path })).toBeNull();
  });

  it.each(["aurralpocket://album/42", "aurralpocket://ssofoo"])(
    "passes %s through",
    (path) => {
      expect(redirectSystemPath({ path })).toBe(path);
    },
  );
});
