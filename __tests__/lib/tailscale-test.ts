import type { TailscaleStatus } from "@/modules/tailscale";

let mockPush: ((status: TailscaleStatus) => void) | null = null;
const mockStart = jest.fn((_options: { port?: number }) =>
  Promise.resolve(47862),
);
const mockForget = jest.fn((_controlURL?: string) => Promise.resolve());

jest.mock("@/modules/tailscale", () => ({
  isTailscaleAvailable: true,
  startTailscale: (options: { port?: number }) => mockStart(options),
  stopTailscale: () => Promise.resolve(),
  forgetTailscale: (controlURL?: string) => mockForget(controlURL),
  getTailscaleStatus: () => ({ state: "NoState" }),
  addTailscaleStatusListener: (listener: (status: TailscaleStatus) => void) => {
    mockPush = listener;
    return { remove() {} };
  },
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(),
}));

const SERVER = "http://aurral-host:3002";

/** Fresh module state for each test: the gateway is a singleton. */
function load() {
  let tailscale!: typeof import("@/lib/tailscale");
  let client!: typeof import("@/lib/api/client");
  let browser!: { openBrowserAsync: jest.Mock; dismissBrowser: jest.Mock };
  // Read AppState off the module when it's used: its getter can hand back
  // another instance than the one the library registered with.
  let reactNative!: { AppState: { addEventListener: jest.Mock } };
  jest.isolateModules(() => {
    tailscale = require("@/lib/tailscale");
    client = require("@/lib/api/client");
    browser = require("expo-web-browser");
    reactNative = require("react-native");
  });
  return { tailscale, client, browser, reactNative };
}

function push(status: TailscaleStatus) {
  mockPush?.(status);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPush = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("waitForTailnet", () => {
  it("resolves once the node is on the tailnet", async () => {
    const { tailscale } = load();
    await tailscale.startGateway(SERVER, {});

    const joined = tailscale.waitForTailnet();
    push({ state: "Starting", port: 47862 });
    push({ state: "Running", port: 47862 });

    await expect(joined).resolves.toBeUndefined();
  });

  it("opens the sign-in page once, and gives up when it closes unsigned", async () => {
    jest.useFakeTimers();
    const { tailscale, browser } = load();
    let close!: () => void;
    browser.openBrowserAsync.mockReturnValue(
      new Promise((resolve) => {
        close = () => resolve({ type: "cancel" });
      }),
    );
    await tailscale.startGateway(SERVER, {});

    const joined = tailscale.waitForTailnet();
    const outcome = expect(joined).rejects.toThrow(
      "Tailscale sign-in wasn't finished.",
    );
    push({ state: "NeedsLogin", loginURL: "https://login.tailscale.com/a/1" });
    // tsnet refreshes the URL while the page is still open.
    push({ state: "NeedsLogin", loginURL: "https://login.tailscale.com/a/2" });
    expect(browser.openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(browser.openBrowserAsync).toHaveBeenCalledWith(
      "https://login.tailscale.com/a/1",
    );

    close();
    await jest.advanceTimersByTimeAsync(10_000);
    await outcome;
  });

  it("closes the sign-in page once the node is on the tailnet", async () => {
    const { tailscale, browser } = load();
    browser.openBrowserAsync.mockReturnValue(new Promise(() => {}));
    await tailscale.startGateway(SERVER, {});

    const joined = tailscale.waitForTailnet();
    push({ state: "NeedsLogin", loginURL: "https://login.tailscale.com/a/1" });
    push({ state: "Running", port: 47862 });

    await expect(joined).resolves.toBeUndefined();
    expect(browser.dismissBrowser).toHaveBeenCalled();
  });

  // Android's Custom Tab answers as soon as it opens, not when it closes.
  it("on Android, waits for the app to come back before giving up", async () => {
    jest.useFakeTimers();
    const { tailscale, browser, reactNative } = load();
    browser.openBrowserAsync.mockResolvedValue({ type: "opened" });
    await tailscale.startGateway(SERVER, {});

    const joined = tailscale.waitForTailnet();
    let settled = false;
    joined.catch(() => {}).finally(() => (settled = true));
    push({ state: "NeedsLogin", loginURL: "https://login.tailscale.com/a/1" });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);

    const onChange =
      reactNative.AppState.addEventListener.mock.calls.at(-1)?.[1];
    onChange("background");
    onChange("active");
    const outcome = expect(joined).rejects.toThrow(
      "Tailscale sign-in wasn't finished.",
    );
    await jest.advanceTimersByTimeAsync(10_000);
    await outcome;
  });

  it("reports a refused auth key instead of opening the sign-in page", async () => {
    jest.useFakeTimers();
    const { tailscale, browser } = load();
    await tailscale.startGateway(SERVER, {}, "tskey-auth-1");

    const joined = tailscale.waitForTailnet({ usingAuthKey: true });
    const outcome = expect(joined).rejects.toThrow(
      "Tailscale didn't accept the auth key: invalid key",
    );
    push({
      state: "NeedsLogin",
      loginURL: "https://login.tailscale.com/a/1",
      error: "invalid key",
    });
    await jest.advanceTimersByTimeAsync(10_000);

    await outcome;
    expect(browser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it("stops waiting when it's cancelled", async () => {
    const { tailscale } = load();
    await tailscale.startGateway(SERVER, {});
    const controller = new AbortController();

    const joined = tailscale.waitForTailnet({ signal: controller.signal });
    controller.abort();

    await expect(joined).rejects.toThrow("Joining the tailnet was cancelled.");
  });
});

describe("the gateway", () => {
  it("moves the API client to a new port", async () => {
    const { tailscale, client } = load();
    client.setBaseUrl(await tailscale.startGateway(SERVER, {}));

    push({ state: "Running", port: 50123 });

    expect(client.getServerUrl()).toBe("http://127.0.0.1:50123");
  });

  it("starts only after an earlier forget has finished", async () => {
    const { tailscale } = load();
    let finishForget!: () => void;
    mockForget.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishForget = resolve;
      }),
    );

    const forgetting = tailscale.forgetGateway(null);
    const starting = tailscale.startGateway(SERVER, {});
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockStart).not.toHaveBeenCalled();

    finishForget();
    await forgetting;
    await starting;
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});
