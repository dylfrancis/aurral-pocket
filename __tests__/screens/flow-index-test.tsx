jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@expo/material-symbols/settings.xml", () => "Settings");
jest.mock("@expo/material-symbols/add.xml", () => "Add");

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
    Toolbar: Object.assign(() => null, { Button: () => null }),
  },
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(),
}));

jest.mock("@/hooks/flow", () => ({
  useFlowStatusSuspense: jest.fn(),
  useSetFlowEnabled: jest.fn(() => ({ mutate: jest.fn() })),
}));

jest.mock("@/components/flow/FlowCard", () => {
  const { Text } = require("react-native");
  return {
    FlowCard: ({ flow }: { flow: { name: string } }) => (
      <Text>{flow.name}</Text>
    ),
  };
});
jest.mock("@/components/flow/FlowDetailSheet", () => ({
  FlowDetailSheet: () => null,
}));

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
