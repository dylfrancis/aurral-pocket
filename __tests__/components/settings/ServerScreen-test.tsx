jest.mock("@expo/ui", () => require("@/test-support/expo-ui"));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const mockAuth = {
  serverUrl: "https://aurral.example.com",
  tailscale: null as { controlURL?: string } | null,
  customHeaders: { "CF-Access-Client-Id": "client-id" } as Record<
    string,
    string
  >,
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockAuth,
}));

let mockTailscaleStatus: Record<string, unknown> = { state: "Off" };
const mockOpenSignIn = jest.fn();
jest.mock("@/lib/tailscale", () => ({
  useTailscaleStatus: () => mockTailscaleStatus,
  openTailscaleSignIn: () => mockOpenSignIn(),
}));

const mockSave = jest.fn();
jest.mock("@/hooks/auth/use-save-custom-headers", () => ({
  useSaveCustomHeaders: () => ({ mutate: mockSave, isPending: false }),
}));

const mockChangeServer = jest.fn();
jest.mock("@/hooks/auth/use-change-server", () => ({
  useChangeServer: () => ({ mutate: mockChangeServer, isPending: false }),
}));

const mockScan = jest.fn();
jest.mock("@/hooks/library/use-library-scan", () => ({
  useLibraryScan: () => ({ scan: mockScan, isScanning: false }),
}));

// The native menu renders nothing under Jest, so it stands in as a button per
// action.
jest.mock("@/components/settings/SettingsActionMenu", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    SettingsActionMenu: ({ actions }: any) =>
      React.createElement(
        View,
        null,
        actions.map((action: any) =>
          React.createElement(
            Pressable,
            { key: action.key, onPress: action.onPress },
            React.createElement(Text, null, action.label),
          ),
        ),
      ),
  };
});

import { Alert, type AlertButton } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { ServerScreen } from "@/components/settings/ServerScreen";

function pressAlertButton(text: string) {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as
    AlertButton[] | undefined;
  buttons?.find((button) => button.text === text)?.onPress?.();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.tailscale = null;
  mockTailscaleStatus = { state: "Off" };
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("ServerScreen", () => {
  describe("for a server reached through Tailscale", () => {
    beforeEach(() => {
      mockAuth.tailscale = {};
    });

    it("shows the node's status and tailnet address", async () => {
      mockTailscaleStatus = {
        state: "Running",
        tailnetIPs: ["100.64.0.7", "fd7a:115c:a1e0::7"],
      };
      const utils = await render(<ServerScreen />);

      expect(utils.getByText("Connected")).toBeTruthy();
      expect(utils.getByText("100.64.0.7")).toBeTruthy();
      expect(utils.queryByText("Sign In to Tailscale")).toBeNull();
    });

    it("signs the node in again when Tailscale asks", async () => {
      mockTailscaleStatus = {
        state: "NeedsLogin",
        loginURL: "https://login.tailscale.com/a/1",
      };
      const utils = await render(<ServerScreen />);

      expect(utils.getByText("Needs Sign-In")).toBeTruthy();
      await fireEvent.press(utils.getByText("Sign In to Tailscale"));
      expect(mockOpenSignIn).toHaveBeenCalled();
    });
  });

  it("shows no Tailscale section for a server reached directly", async () => {
    const utils = await render(<ServerScreen />);
    expect(utils.queryByText("Tailscale")).toBeNull();
    expect(utils.queryByText("Status")).toBeNull();
  });

  it("adds a header to the saved ones without showing their values", async () => {
    const utils = await render(<ServerScreen />);
    expect(utils.queryByText("client-id")).toBeNull();

    await fireEvent.press(utils.getByText("Add Header"));
    await fireEvent.changeText(
      utils.getByPlaceholderText("Header name"),
      " CF-Access-Client-Secret ",
    );
    await fireEvent.changeText(utils.getByPlaceholderText("Value"), " s3cret ");
    await fireEvent.press(utils.getByText("Save Header"));

    expect(mockSave).toHaveBeenCalledWith(
      {
        "CF-Access-Client-Id": "client-id",
        "CF-Access-Client-Secret": "s3cret",
      },
      expect.anything(),
    );
  });

  it("won't add a header pocket sets itself", async () => {
    const utils = await render(<ServerScreen />);

    await fireEvent.press(utils.getByText("Add Header"));
    await fireEvent.changeText(
      utils.getByPlaceholderText("Header name"),
      "Authorization",
    );
    await fireEvent.changeText(utils.getByPlaceholderText("Value"), "x");
    await fireEvent.press(utils.getByText("Save Header"));

    expect(
      utils.getByText("Aurral Pocket sets Authorization itself."),
    ).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("removes a header after asking", async () => {
    const utils = await render(<ServerScreen />);

    await fireEvent.press(utils.getByText("CF-Access-Client-Id"));
    pressAlertButton("Remove");

    expect(mockSave).toHaveBeenCalledWith({}, expect.anything());
  });

  it.each([
    ["Quick Scan", "quick"],
    ["Full Scan", "full"],
  ])("starts a library scan from %s", async (label, mode) => {
    const utils = await render(<ServerScreen />);

    await fireEvent.press(utils.getByText(label));

    expect(mockScan).toHaveBeenCalledWith({ mode }, expect.anything());
  });

  it("changes server only once confirmed", async () => {
    const utils = await render(<ServerScreen />);

    await fireEvent.press(utils.getByText("Change Server"));
    expect(mockChangeServer).not.toHaveBeenCalled();
    pressAlertButton("Change Server");

    expect(mockChangeServer).toHaveBeenCalled();
  });
});
