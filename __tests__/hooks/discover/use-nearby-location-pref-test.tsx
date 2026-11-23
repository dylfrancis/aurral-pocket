jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

type Storage = { getItem: jest.Mock; setItem: jest.Mock };

// The saved location is one store per app run, so each test loads a fresh copy
// of the hook, along with the React and storage modules it renders against.
// The pure entry registers no hooks of its own, so it can load inside a test.
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function load(stored: Record<string, string> = {}) {
  jest.resetModules();
  const testing = require("@testing-library/react-native/pure");
  cleanup = testing.cleanup;
  const storage: Storage =
    require("@react-native-async-storage/async-storage").default;
  storage.getItem.mockImplementation((key: string) =>
    Promise.resolve(stored[key] ?? null),
  );
  storage.setItem.mockResolvedValue(undefined);
  const { useNearbyLocationPref } =
    require("@/hooks/discover/use-nearby-location-pref") as typeof import("@/hooks/discover/use-nearby-location-pref");
  return { ...testing, storage, useNearbyLocationPref } as {
    renderHook: typeof import("@testing-library/react-native").renderHook;
    act: typeof import("@testing-library/react-native").act;
    waitFor: typeof import("@testing-library/react-native").waitFor;
    storage: Storage;
    useNearbyLocationPref: typeof useNearbyLocationPref;
  };
}

async function renderHydrated(t: ReturnType<typeof load>) {
  const hook = await t.renderHook(() => t.useNearbyLocationPref());
  await t.waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe("useNearbyLocationPref", () => {
  it("starts on Your Location before the saved location loads", async () => {
    const t = load();
    t.storage.getItem.mockImplementation(() => new Promise(() => {}));

    const { result } = await t.renderHook(() => t.useNearbyLocationPref());

    expect(result.current.mode).toBe("ip");
    expect(result.current.appliedZip).toBe("");
    expect(result.current.hydrated).toBe(false);
  });

  it("restores the saved mode, ZIP and country", async () => {
    const t = load({
      discoverNearbyMode: "zip",
      discoverNearbyZip: "75001",
      discoverNearbyCountry: "FR",
    });

    const { result } = await renderHydrated(t);

    expect(result.current.mode).toBe("zip");
    expect(result.current.appliedZip).toBe("75001");
    expect(result.current.appliedCountry).toBe("FR");
  });

  it("ignores an unknown saved mode", async () => {
    const t = load({ discoverNearbyMode: "garbage" });

    const { result } = await renderHydrated(t);

    expect(result.current.mode).toBe("ip");
  });

  it("still loads when storage can't be read", async () => {
    const t = load();
    t.storage.getItem.mockRejectedValue(new Error("storage unavailable"));

    const { result } = await renderHydrated(t);

    expect(result.current.mode).toBe("ip");
    expect(result.current.appliedZip).toBe("");
  });

  it("saves an entered location as ZIP mode, trimmed and upper-cased", async () => {
    const t = load();
    const { result } = await renderHydrated(t);

    await t.act(() => result.current.setAppliedZip(" 75001 ", " fr "));

    expect(result.current).toMatchObject({
      mode: "zip",
      appliedZip: "75001",
      appliedCountry: "FR",
    });
    expect(t.storage.setItem).toHaveBeenCalledWith("discoverNearbyMode", "zip");
    expect(t.storage.setItem).toHaveBeenCalledWith(
      "discoverNearbyZip",
      "75001",
    );
    expect(t.storage.setItem).toHaveBeenCalledWith(
      "discoverNearbyCountry",
      "FR",
    );
  });

  it("saves a switch back to Your Location", async () => {
    const t = load({ discoverNearbyMode: "zip", discoverNearbyZip: "45202" });
    const { result } = await renderHydrated(t);

    await t.act(() => result.current.setMode("ip"));

    expect(result.current.mode).toBe("ip");
    expect(t.storage.setItem).toHaveBeenCalledWith("discoverNearbyMode", "ip");
  });

  it("gives the Discover rail the location picked on the Shows page", async () => {
    const t = load();
    const rail = await renderHydrated(t);
    const page = await renderHydrated(t);

    await t.act(() => page.result.current.setAppliedZip("45202"));

    expect(rail.result.current.mode).toBe("zip");
    expect(rail.result.current.appliedZip).toBe("45202");
  });

  it("keeps a location picked before the saved one finished loading", async () => {
    const t = load({ discoverNearbyMode: "zip", discoverNearbyZip: "45202" });
    let finishRead: () => void = () => {};
    const read = new Promise<void>((resolve) => {
      finishRead = resolve;
    });
    t.storage.getItem.mockImplementation(async (key: string) => {
      await read;
      return key === "discoverNearbyMode" ? "zip" : "45202";
    });
    const { result } = await t.renderHook(() => t.useNearbyLocationPref());

    await t.act(() => result.current.setMode("ip"));
    await t.act(async () => finishRead());
    await t.waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.mode).toBe("ip");
  });

  it("keeps the new location when storage can't be written", async () => {
    const t = load();
    t.storage.setItem.mockRejectedValue(new Error("disk full"));
    const { result } = await renderHydrated(t);

    // A rejected write is swallowed; awaiting act would reject if it surfaced.
    await t.act(() => result.current.setAppliedZip("12345"));

    expect(result.current.appliedZip).toBe("12345");
  });
});
