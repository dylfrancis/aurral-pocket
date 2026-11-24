// Each test loads its own copy of the hook, as a fresh launch does: the hook
// keeps each account's layout for the rest of the run. RNTL's pure entry is
// used because the default one registers cleanup hooks, which can't run
// mid-test.
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: 7 } }),
}));

type Modules = {
  AsyncStorage: typeof import("@react-native-async-storage/async-storage").default;
  rntl: typeof import("@testing-library/react-native/pure");
  layout: typeof import("@/hooks/library/use-artist-page-layout");
};

let launched: Modules | null = null;

function launch(): Modules {
  jest.resetModules();
  launched = {
    AsyncStorage: require("@react-native-async-storage/async-storage"),
    rntl: require("@testing-library/react-native/pure"),
    layout: require("@/hooks/library/use-artist-page-layout"),
  };
  return launched;
}

afterEach(async () => {
  await launched?.rntl.cleanup();
  launched = null;
});

const ids = (sections: { id: string; enabled: boolean }[]) =>
  sections.map(({ id, enabled }) => (enabled ? id : `-${id}`));

describe("useArtistPageLayout", () => {
  it("reads the account's saved layout, dropping old sections and adding new ones beside their neighbors", async () => {
    const { AsyncStorage, rntl, layout } = launch();
    await AsyncStorage.setItem(
      "artistPageLayout:7",
      JSON.stringify([
        { id: "about", enabled: true },
        { id: "videos", enabled: true },
        { id: "songs", enabled: false },
        { id: "about", enabled: false },
      ]),
    );

    const { result } = await rntl.renderHook(() =>
      layout.useArtistPageLayout(),
    );
    await rntl.waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(ids(result.current.sections)).toEqual([
      "tags",
      "favorites",
      "about",
      "-songs",
      "library",
      "releases",
      "similar",
    ]);
  });

  it("saves for the account and reaches every page holding the layout", async () => {
    const { AsyncStorage, rntl, layout } = launch();
    const settings = await rntl.renderHook(() => layout.useArtistPageLayout());
    const page = await rntl.renderHook(() => layout.useArtistPageLayout());
    await rntl.waitFor(() => expect(page.result.current.hydrated).toBe(true));

    const next = [...layout.DEFAULT_ARTIST_PAGE_SECTIONS]
      .reverse()
      .map((section) => ({ ...section, enabled: section.id !== "tags" }));
    await rntl.act(() => settings.result.current.saveLayout(next));

    expect(ids(page.result.current.sections)).toEqual([
      "about",
      "similar",
      "releases",
      "library",
      "songs",
      "favorites",
      "-tags",
    ]);
    expect(
      JSON.parse((await AsyncStorage.getItem("artistPageLayout:7")) ?? "[]"),
    ).toEqual(next.map(({ id, enabled }) => ({ id, enabled })));
  });
});
