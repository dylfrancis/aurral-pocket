// Activity and Settings are tabs on iOS and screens above the tabs on Android,
// with a route tree in each place answering the same paths. On Android the
// tabs' copy has no trigger, and the tabs redirect anything that lands there
// to Discover. These run Expo Router's own resolution over stand-in screens in
// the same groups, so they fail if a link reaches the wrong copy.
const mockPlatform = { IS_IOS: false, IS_ANDROID: true };
jest.mock("@/constants/platform", () => ({
  get IS_IOS() {
    return mockPlatform.IS_IOS;
  },
  get IS_ANDROID() {
    return mockPlatform.IS_ANDROID;
  },
}));

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";
import { Pressable, Text } from "react-native";
import { router, Stack, Tabs } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { fireEvent } from "@testing-library/react-native";
import { useNavigateToTab } from "@/hooks/use-navigate-to-tab";
import { useOpenOverflowScreen } from "@/hooks/use-open-overflow-screen";

function Discover() {
  const open = useOpenOverflowScreen();
  return (
    <>
      <Text>Discover</Text>
      <Pressable onPress={() => open("settings")}>
        <Text>Open Settings</Text>
      </Pressable>
      <Pressable onPress={() => open("activity")}>
        <Text>Open Activity</Text>
      </Pressable>
    </>
  );
}

function AboveTabsSettings() {
  return (
    <>
      <Text>Settings above the tabs</Text>
      <Pressable onPress={() => router.push("/settings/account")}>
        <Text>Open Account</Text>
      </Pressable>
    </>
  );
}

function AboveTabsActivity() {
  const navigateToTab = useNavigateToTab();
  return (
    <>
      <Text>Activity above the tabs</Text>
      <Pressable
        onPress={() => navigateToTab("/(app)/(tabs)/(library)/playlists")}
      >
        <Text>Open Playlists</Text>
      </Pressable>
    </>
  );
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "(app)/_layout": () => <Stack screenOptions={{ headerShown: false }} />,
  // Only the declared tabs show, as in the app's Android tab bar.
  "(app)/(tabs)/_layout": () => (
    <Tabs>
      <Tabs.Screen name="(discover)" />
      <Tabs.Screen name="(library)" />
    </Tabs>
  ),
  "(app)/(tabs)/(discover)/_layout": () => <Stack />,
  "(app)/(tabs)/(library)/_layout": () => <Stack />,
  "(app)/(tabs)/(settings)/_layout": () => <Stack />,
  "(app)/(tabs)/(activity)/_layout": () => <Stack />,
  "(app)/(settings)/_layout": () => <Stack />,
  "(app)/(activity)/_layout": () => <Stack />,
  "(app)/(tabs)/(discover)/index": Discover,
  "(app)/(tabs)/(library)/index": () => <Text>Library</Text>,
  "(app)/(tabs)/(library)/playlists": () => <Text>Playlists</Text>,
  "(app)/(tabs)/(settings)/settings/index": () => <Text>Settings tab</Text>,
  "(app)/(tabs)/(activity)/queue": () => <Text>Activity tab</Text>,
  "(app)/(tabs)/(settings)/settings/account": () => <Text>Account tab</Text>,
  "(app)/(settings)/settings/index": AboveTabsSettings,
  "(app)/(settings)/settings/account": () => (
    <Text>Account above the tabs</Text>
  ),
  "(app)/(activity)/queue": AboveTabsActivity,
};

describe("Activity and Settings on Android", () => {
  it("opens Settings above the tabs, not in the tabs' hidden copy", async () => {
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.press(screen.getByText("Open Settings"));

    expect(screen.getByText("Settings above the tabs")).toBeTruthy();
  });

  it("keeps a page Settings pushes in the copy above the tabs", async () => {
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.press(screen.getByText("Open Settings"));

    await fireEvent.press(screen.getByText("Open Account"));

    expect(screen.getByText("Account above the tabs")).toBeTruthy();
  });

  it("leaves Activity for a tab without stacking a second set of tabs", async () => {
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.press(screen.getByText("Open Activity"));

    await fireEvent.press(screen.getByText("Open Playlists"));
    expect(screen.getByText("Playlists")).toBeTruthy();

    await act(() => router.back());
    expect(screen.queryByText("Activity above the tabs")).toBeNull();
  });
});

describe("the Android route trees", () => {
  // A route in one copy but not the other sends a link on Android into the
  // hidden tabs, which redirect to Discover.
  const app = join(__dirname, "../../app/(app)");
  const files = (root: string, dir = root): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? files(root, path)
        : [relative(root, path)];
    });

  it.each(["(activity)", "(settings)"])(
    "%s above the tabs re-exports every route of its tab",
    (group) => {
      const tab = files(join(app, "(tabs)", group)).sort();
      const mirror = files(join(app, group)).sort();
      expect(mirror).toEqual(tab);

      for (const file of mirror) {
        const source = `@/app/(app)/(tabs)/${group}/${file.replace(/\.tsx$/, "")}`;
        expect(readFileSync(join(app, group, file), "utf8")).toBe(
          `export { default } from "${source}";\nexport * from "${source}";\n`,
        );
      }
    },
  );
});
