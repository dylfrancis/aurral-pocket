jest.mock("expo/fetch", () => ({
  fetch: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  const createIconMock = () => {
    const Icon = ({ name, testID, ...props }: any) =>
      React.createElement(View, { ...props, testID: testID ?? `icon-${name}` });
    Icon.displayName = "MockIcon";
    return Icon;
  };

  return {
    Ionicons: createIconMock(),
    MaterialIcons: createIconMock(),
    FontAwesome: createIconMock(),
  };
});
