jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@expo/material-symbols/settings.xml", () => "Settings");
jest.mock("@expo/material-symbols/add.xml", () => "Add");
jest.mock("@expo/material-symbols/tune.xml", () => "Tune");
jest.mock("@expo/material-symbols/graphic_eq.xml", () => "GraphicEq");

const mockPush = jest.fn();
// Android's overflow menu is covered by the overflow screens suite.
jest.mock("@/components/navigation/OverflowMenu", () => ({
  OverflowMenu: () => null,
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  // The native menu renders nothing under Jest, so each action renders as a
  // pressable labelled by its title.
  const MenuAction = ({ children, disabled, onPress }: any) =>
    React.createElement(
      Pressable,
      { disabled, onPress },
      React.createElement(Text, null, children),
    );
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  return {
    Stack: {
      Screen: () => null,
      Toolbar: Object.assign(Passthrough, {
        Button: () => null,
        Menu: Passthrough,
        MenuAction,
      }),
    },
    useRouter: jest.fn(() => ({ push: mockPush })),
  };
});

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(),
}));

const mockCreateFromTemplate = jest.fn();
jest.mock("@/hooks/flow", () => ({
  useCreateFlowFromTemplate: jest.fn(() => ({
    mutate: mockCreateFromTemplate,
    isPending: false,
  })),
  useFlowStatusSuspense: jest.fn(),
  useFlowTemplates: jest.fn(() => ({
    data: [
      {
        id: "focus-listening-history",
        name: "Listening History",
        description: "Tracks based on what you've recently been listening to",
        available: false,
      },
      {
        id: "release-radar",
        name: "Release Radar",
        description:
          "Up to one track from each recent album missing in your library",
        available: true,
      },
    ],
  })),
  useSetFlowEnabled: jest.fn(() => ({ mutate: jest.fn() })),
}));

jest.mock("@/components/flow/FlowCard", () => {
  const { Text } = require("react-native");
  return {
    FlowCard: ({
      flow,
      onPress,
    }: {
      flow: { name: string };
      onPress: () => void;
    }) => <Text onPress={onPress}>{flow.name}</Text>,
  };
});

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheetModal = React.forwardRef(function MockBottomSheetModal(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  return { __esModule: true, BottomSheetModal };
});

import React from "react";
import { Alert } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import FlowScreen from "@/app/(app)/(tabs)/(flow)/index";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useFlowStatusSuspense } from "@/hooks/flow";

const mockUseHasPermission = useHasPermission as jest.Mock;
const mockUseFlowStatusSuspense = useFlowStatusSuspense as jest.Mock;

function grantPermission(granted: boolean) {
  mockUseHasPermission.mockReturnValue(() => granted);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateFromTemplate.mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockUseFlowStatusSuspense.mockReturnValue({
    data: { flows: [], sharedPlaylists: [], flowStats: {} },
    refetch: jest.fn(),
  });
});

describe("FlowScreen permission gate", () => {
  it("does not fetch flow status when the user lacks accessFlow", async () => {
    grantPermission(false);

    await render(<FlowScreen />);

    // The whole point of the gate: NativeTabs mounts this screen at launch even
    // when the tab is hidden, so a permissionless user must not reach the API.
    expect(mockUseFlowStatusSuspense).not.toHaveBeenCalled();
  });

  it("explains the lack of access instead of rendering an empty list", async () => {
    grantPermission(false);

    const { getByText } = await render(<FlowScreen />);

    expect(getByText("You don't have access to Flows")).toBeTruthy();
  });

  it("fetches flow status once the user has accessFlow", async () => {
    grantPermission(true);

    await render(<FlowScreen />);

    expect(mockUseFlowStatusSuspense).toHaveBeenCalled();
  });
});

describe("FlowScreen list", () => {
  beforeEach(() => grantPermission(true));

  it("leaves static playlists to Library", async () => {
    mockUseFlowStatusSuspense.mockReturnValue({
      data: {
        flows: [{ id: "flow-1", name: "Chill" }],
        sharedPlaylists: [{ id: "pl-1", name: "Road Trip" }],
        flowStats: {},
      },
      refetch: jest.fn(),
    });

    const { getByText, queryByText } = await render(<FlowScreen />);

    expect(getByText("Chill")).toBeTruthy();
    expect(queryByText("Road Trip")).toBeNull();
  });

  it("opens a flow on its own page", async () => {
    mockUseFlowStatusSuspense.mockReturnValue({
      data: {
        flows: [{ id: "flow-1", name: "Chill" }],
        sharedPlaylists: [],
        flowStats: {},
      },
      refetch: jest.fn(),
    });

    const { getByText } = await render(<FlowScreen />);
    await fireEvent.press(getByText("Chill"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/flow/[id]",
      params: { id: "flow-1" },
    });
  });

  it("offers to create a flow when only static playlists exist", async () => {
    mockUseFlowStatusSuspense.mockReturnValue({
      data: {
        flows: [],
        sharedPlaylists: [{ id: "pl-1", name: "Road Trip" }],
        flowStats: {},
      },
      refetch: jest.fn(),
    });

    const { getByText } = await render(<FlowScreen />);
    await fireEvent.press(getByText("Create Flow"));

    expect(getByText("No flows yet")).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/(flow)/flow-edit");
  });
});

describe("FlowScreen new flow menu", () => {
  beforeEach(() => grantPermission(true));

  it("opens the custom flow form", async () => {
    const { getByText } = await render(<FlowScreen />);
    await fireEvent.press(getByText("Custom Flow"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/(flow)/flow-edit");
  });

  it("creates a flow from a template and opens it", async () => {
    mockCreateFromTemplate.mockImplementation((_templateId, { onSuccess }) =>
      onSuccess({ id: "flow-new" }),
    );

    const { getByText } = await render(<FlowScreen />);
    await fireEvent.press(getByText("Release Radar"));

    expect(mockCreateFromTemplate).toHaveBeenCalledWith(
      "release-radar",
      expect.anything(),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/flow/[id]",
      params: { id: "flow-new" },
    });
  });

  it("lists an unavailable template but won't create it", async () => {
    const { getByText } = await render(<FlowScreen />);
    await fireEvent.press(getByText("Listening History"));

    expect(mockCreateFromTemplate).not.toHaveBeenCalled();
  });

  it("shows why a template flow couldn't be created", async () => {
    const reason = '"Release Radar" is already used by a flow or a playlist.';
    mockCreateFromTemplate.mockImplementation((_templateId, { onError }) =>
      onError(new Error(reason)),
    );

    const { getByText } = await render(<FlowScreen />);
    await fireEvent.press(getByText("Release Radar"));

    expect(Alert.alert).toHaveBeenCalledWith("Could not create", reason);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
