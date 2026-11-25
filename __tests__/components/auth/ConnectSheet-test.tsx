jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

const mockSetServer = jest.fn(() => Promise.resolve());
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ setServer: mockSetServer }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/hooks/auth/use-server-connect", () => ({
  useServerConnect: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    isNetworkError: boolean;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.isNetworkError = status === 0;
    }
  },
}));

import { Linking, Pressable } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { ConnectSheet } from "@/components/auth/ConnectSheet";
import { useSheet } from "@/components/ui/AppSheet";
import { useServerConnect } from "@/hooks/auth/use-server-connect";
import * as Haptics from "expo-haptics";

const mockUseServerConnect = useServerConnect as jest.Mock;

/** Get Started's sheet, already up, with its button to open it again. */
function OpenConnectSheet() {
  const sheet = useSheet({ presented: true });
  return (
    <>
      <Pressable accessibilityLabel="Get Started" onPress={sheet.present} />
      <ConnectSheet sheet={sheet} />
    </>
  );
}

const unansweredCheck = () => jest.fn(() => new Promise<never>(() => {}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseServerConnect.mockReturnValue({
    mutateAsync: unansweredCheck(),
    isPending: false,
    error: null,
  });
});

describe("ConnectSheet", () => {
  it("renders title and subtitle", async () => {
    const { getByText } = await render(<OpenConnectSheet />);
    expect(getByText("Connect to Server")).toBeTruthy();
    expect(getByText("Enter the URL of your Aurral server")).toBeTruthy();
  });

  it("opens the Aurral docs from the server link", async () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue();
    const { getByText } = await render(<OpenConnectSheet />);
    const link = getByText("How can I get my own Aurral server?");
    expect(link).toBeTruthy();
    await fireEvent.press(link);
    expect(openURLSpy).toHaveBeenCalledWith("https://docs.aurral.org/");
    openURLSpy.mockRestore();
  });

  it("renders input field with correct placeholder", async () => {
    const { getByPlaceholderText } = await render(<OpenConnectSheet />);
    expect(
      getByPlaceholderText("https://your-server.example.com"),
    ).toBeTruthy();
  });

  it("renders connect button", async () => {
    const { getByText } = await render(<OpenConnectSheet />);
    expect(getByText("Connect")).toBeTruthy();
  });

  it("checks a valid URL on button press", async () => {
    const mutateAsync = unansweredCheck();
    mockUseServerConnect.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });

    const { getByPlaceholderText, getByText } = await render(
      <OpenConnectSheet />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("https://your-server.example.com"),
      "https://my-server.com",
    );
    await fireEvent.press(getByText("Connect"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        url: "https://my-server.com",
        headers: {},
      });
    });
  });

  it("connects with the headers entered under Advanced", async () => {
    const mutateAsync = unansweredCheck();
    mockUseServerConnect.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });

    const screen = await render(<OpenConnectSheet />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("https://your-server.example.com"),
      "https://my-server.com",
    );
    await fireEvent.press(screen.getByText("Advanced"));
    await fireEvent.changeText(
      screen.getByLabelText("Header name"),
      " CF-Access-Client-Id ",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Value for CF-Access-Client-Id"),
      "id.access",
    );
    await fireEvent.press(screen.getByText("Connect"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        url: "https://my-server.com",
        headers: { "CF-Access-Client-Id": "id.access" },
      });
    });
  });

  it("reopens Advanced to show a header that blocks connecting", async () => {
    const mutateAsync = unansweredCheck();
    mockUseServerConnect.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });

    const screen = await render(<OpenConnectSheet />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("https://your-server.example.com"),
      "https://my-server.com",
    );
    await fireEvent.press(screen.getByText("Advanced"));
    await fireEvent.changeText(
      screen.getByLabelText("Header name"),
      "Authorization",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Value for Authorization"),
      "Basic abc",
    );
    await fireEvent.press(screen.getByText("Advanced"));
    await fireEvent.press(screen.getByText("Connect"));

    await waitFor(() => {
      expect(
        screen.getByText("Aurral Pocket sets Authorization itself."),
      ).toBeTruthy();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("does not check an invalid URL", async () => {
    const mutateAsync = unansweredCheck();
    mockUseServerConnect.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });

    const { getByPlaceholderText, getByText } = await render(
      <OpenConnectSheet />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("https://your-server.example.com"),
      "not-a-url",
    );
    await fireEvent.press(getByText("Connect"));

    await waitFor(() => {
      expect(getByText("URL must start with http:// or https://")).toBeTruthy();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("shows validation error for non-http URL", async () => {
    const { getByPlaceholderText, getByText } = await render(
      <OpenConnectSheet />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("https://your-server.example.com"),
      "ftp://bad-protocol.com",
    );
    await fireEvent.press(getByText("Connect"));

    await waitFor(() => {
      expect(getByText("URL must start with http:// or https://")).toBeTruthy();
    });
  });

  it("shows network error from mutation", async () => {
    const { ApiError } = require("@/lib/api/client");
    mockUseServerConnect.mockReturnValue({
      mutateAsync: unansweredCheck(),
      isPending: false,
      error: new ApiError(0, "Network error"),
    });

    const { getByText } = await render(<OpenConnectSheet />);
    expect(
      getByText("Could not reach server. Check the URL and try again."),
    ).toBeTruthy();
  });

  it("disables input when pending", async () => {
    mockUseServerConnect.mockReturnValue({
      mutateAsync: unansweredCheck(),
      isPending: true,
      error: null,
    });

    const { getByPlaceholderText } = await render(<OpenConnectSheet />);
    const input = getByPlaceholderText("https://your-server.example.com");
    expect(input.props.editable).toBe(false);
  });

  describe("once the server answers", () => {
    const server = {
      url: "https://my-server.com",
      health: { authRequired: true },
      headers: { "CF-Access-Client-Id": "id.access" },
    };
    let answer: (value: typeof server) => void;

    async function connect() {
      mockUseServerConnect.mockReturnValue({
        mutateAsync: jest.fn(
          () =>
            new Promise((resolve) => {
              answer = resolve;
            }),
        ),
        isPending: false,
        error: null,
      });
      const screen = await render(<OpenConnectSheet />);
      await fireEvent.changeText(
        screen.getByPlaceholderText("https://your-server.example.com"),
        "https://my-server.com",
      );
      await fireEvent.press(screen.getByText("Connect"));
      return screen;
    }

    it("saves the server only once the sheet has closed", async () => {
      const screen = await connect();

      await act(async () => answer(server));

      expect(screen.queryByText("Connect to Server")).toBeNull();
      expect(mockSetServer).toHaveBeenCalledWith(
        server.url,
        server.health,
        server.headers,
      );
    });

    it("still saves it after the sheet was swiped away during the check", async () => {
      const screen = await connect();
      await fireEvent.press(screen.getByLabelText("Dismiss sheet"));
      expect(mockSetServer).not.toHaveBeenCalled();

      await act(async () => answer(server));

      expect(mockSetServer).toHaveBeenCalledWith(
        server.url,
        server.health,
        server.headers,
      );
    });
  });

  it("starts blank each time it opens", async () => {
    const screen = await render(<OpenConnectSheet />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("https://your-server.example.com"),
      "not-a-url",
    );
    await fireEvent.press(screen.getByText("Connect"));
    await screen.findByText("URL must start with http:// or https://");

    await fireEvent.press(screen.getByLabelText("Dismiss sheet"));
    await fireEvent.press(screen.getByLabelText("Get Started"));

    expect(
      screen.getByPlaceholderText("https://your-server.example.com").props
        .value,
    ).toBe("");
    expect(
      screen.queryByText("URL must start with http:// or https://"),
    ).toBeNull();
  });

  it("triggers haptic feedback on connect", async () => {
    const mutateAsync = unansweredCheck();
    mockUseServerConnect.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });

    const { getByPlaceholderText, getByText } = await render(
      <OpenConnectSheet />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("https://your-server.example.com"),
      "https://valid.com",
    );
    await fireEvent.press(getByText("Connect"));

    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );
    });
  });
});
