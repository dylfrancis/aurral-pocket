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
  customHeaders: { "CF-Access-Client-Id": "client-id" } as Record<
    string,
    string
  >,
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockAuth,
}));

const mockSave = jest.fn();
jest.mock("@/hooks/auth/use-save-custom-headers", () => ({
  useSaveCustomHeaders: () => ({ mutate: mockSave, isPending: false }),
}));

const mockChangeServer = jest.fn();
jest.mock("@/hooks/auth/use-change-server", () => ({
  useChangeServer: () => ({ mutate: mockChangeServer, isPending: false }),
}));

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
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("ServerScreen", () => {
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

  it("changes server only once confirmed", async () => {
    const utils = await render(<ServerScreen />);

    await fireEvent.press(utils.getByText("Change Server"));
    expect(mockChangeServer).not.toHaveBeenCalled();
    pressAlertButton("Change Server");

    expect(mockChangeServer).toHaveBeenCalled();
  });
});
