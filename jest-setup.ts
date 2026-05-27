jest.mock("expo/fetch", () => ({
  fetch: jest.fn(),
}));

// The native ShazamKit module isn't linked under Jest; default to "unavailable"
// so importers are safe. The hook test overrides this with a controllable mock.
jest.mock("@/modules/shazam", () => ({
  isShazamAvailable: false,
  startListening: jest.fn(() => Promise.resolve()),
  stopListening: jest.fn(() => Promise.resolve()),
  addMatchListener: jest.fn(() => null),
  addNoMatchListener: jest.fn(() => null),
  addErrorListener: jest.fn(() => null),
  addLevelListener: jest.fn(() => null),
}));

jest.mock("burnt", () => ({
  toast: jest.fn(),
  alert: jest.fn(),
  dismissAllAlerts: jest.fn(),
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
