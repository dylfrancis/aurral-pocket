// Each test loads its own copy of the hook, as a fresh launch does: the hook
// keeps what it read for the rest of the run. RNTL's pure entry is used
// because the default one registers cleanup hooks, which can't run mid-test.
type Modules = {
  AsyncStorage: typeof import("@react-native-async-storage/async-storage").default;
  rntl: typeof import("@testing-library/react-native/pure");
  useLibraryView: typeof import("@/hooks/library/use-library-view").useLibraryView;
  useRememberedListValue: typeof import("@/hooks/library/use-library-view").useRememberedListValue;
};

let launched: Modules | null = null;

function launch(): Modules {
  jest.resetModules();
  launched = {
    AsyncStorage: require("@react-native-async-storage/async-storage"),
    rntl: require("@testing-library/react-native/pure"),
    useLibraryView: require("@/hooks/library/use-library-view").useLibraryView,
    useRememberedListValue: require("@/hooks/library/use-library-view")
      .useRememberedListValue,
  };
  return launched;
}

afterEach(async () => {
  await launched?.rntl.cleanup();
  launched = null;
});

const SORTS = ["name-asc", "played", "random"] as const;
const SHOWS = ["all", "favorites"] as const;

describe("useLibraryView", () => {
  it("stores each list's sort, show and status under its own key", async () => {
    const { AsyncStorage, rntl, useLibraryView } = launch();
    await AsyncStorage.setItem(
      "library_views",
      JSON.stringify({ "library-artists": { sort: "plays" } }),
    );
    const { result } = await rntl.renderHook(() =>
      useLibraryView("library-songs", SORTS, SHOWS),
    );

    await rntl.act(async () => result.current.setSort("played"));
    await rntl.act(async () => result.current.setShow("favorites"));
    await rntl.act(async () => result.current.setStatus("missing"));

    expect(
      JSON.parse((await AsyncStorage.getItem("library_views")) ?? "{}"),
    ).toEqual({
      "library-artists": { sort: "plays" },
      "library-songs": { sort: "played", show: "favorites", status: "missing" },
    });
  });

  it("keeps both of two changes made before the list renders again", async () => {
    // While a Suspense list loads the first change, the second is picked from
    // a screen still showing the old view.
    const { rntl, useLibraryView } = launch();
    const { result } = await rntl.renderHook(() =>
      useLibraryView("library-songs", SORTS, SHOWS),
    );
    const { setSort, setStatus } = result.current;

    await rntl.act(async () => {
      setSort("played");
      setStatus("missing");
    });

    expect(result.current.view).toEqual({
      sort: "played",
      show: "all",
      status: "missing",
    });
  });

  it("opens a list on the view it was left on before the launch", async () => {
    const { AsyncStorage, rntl, useLibraryView } = launch();
    await AsyncStorage.setItem(
      "library_views",
      JSON.stringify({
        "library-songs": { sort: "played", show: "favorites", status: null },
      }),
    );

    const { result } = await rntl.renderHook(() =>
      useLibraryView("library-songs", SORTS, SHOWS),
    );

    await rntl.waitFor(() =>
      expect(result.current.view).toEqual({
        sort: "played",
        show: "favorites",
        status: null,
      }),
    );
  });

  it("opens on a rail's sort without changing the view it remembers", async () => {
    const { AsyncStorage, rntl, useLibraryView } = launch();
    const stored = {
      "library-songs": { sort: "name-asc", show: "favorites", status: null },
    };
    await AsyncStorage.setItem("library_views", JSON.stringify(stored));
    const { result } = await rntl.renderHook(() =>
      useLibraryView("library-songs", SORTS, SHOWS, "played"),
    );
    // Lets the stored views load.
    await rntl.act(async () => {});

    expect(result.current.view).toEqual({
      sort: "played",
      show: "all",
      status: null,
    });
    expect(
      JSON.parse((await AsyncStorage.getItem("library_views")) ?? "{}"),
    ).toEqual(stored);
  });

  it("falls back to the list's defaults for what it no longer offers", async () => {
    const { AsyncStorage, rntl, useLibraryView } = launch();
    await AsyncStorage.setItem(
      "library_views",
      JSON.stringify({
        // Saved Offline belongs to the Albums list, and the server refuses
        // any status but its three.
        "library-songs": { sort: "shuffle", show: "saved", status: "wanted" },
      }),
    );
    const { result } = await rntl.renderHook(() =>
      useLibraryView("library-songs", SORTS, SHOWS),
    );
    // Lets the stored views load.
    await rntl.act(async () => {});

    expect(result.current.view).toEqual({
      sort: "name-asc",
      show: "all",
      status: null,
    });
  });
});

describe("useRememberedListValue", () => {
  const parse = (stored: unknown) =>
    stored === "plays" || stored === "favorites" ? stored : "top";

  it("keeps a value beside the list views and reads it back next launch", async () => {
    const first = launch();
    await first.AsyncStorage.setItem(
      "library_views",
      JSON.stringify({ "library-songs": { sort: "played" } }),
    );
    const { result } = await first.rntl.renderHook(() =>
      first.useRememberedListValue("artist-songs", parse),
    );
    await first.rntl.act(async () => result.current[1]("plays"));
    const stored = await first.AsyncStorage.getItem("library_views");
    await first.rntl.cleanup();

    const second = launch();
    await second.AsyncStorage.setItem("library_views", stored ?? "{}");
    const { result: relaunched } = await second.rntl.renderHook(() =>
      second.useRememberedListValue("artist-songs", parse),
    );

    expect(relaunched.current[0]).toBe("plays");
    expect(JSON.parse(stored ?? "{}")).toEqual({
      "library-songs": { sort: "played" },
      "artist-songs": "plays",
    });
  });

  it("falls back to parse's default for a value it no longer offers", async () => {
    const { AsyncStorage, rntl, useRememberedListValue } = launch();
    await AsyncStorage.setItem(
      "library_views",
      JSON.stringify({ "artist-songs": "radio" }),
    );
    const { result } = await rntl.renderHook(() =>
      useRememberedListValue("artist-songs", parse),
    );

    expect(result.current[0]).toBe("top");
  });
});
