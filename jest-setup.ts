// jest-expo 57's generated ExpoObserve mock predates expo-image's observe
// integration, so it has no getIntegrations() — which expo-image calls at import
// time, crashing any suite that imports it. expo-observe isn't a dependency here,
// so drop the module and let the integration no-op like it does on device.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NativeModulesProxy } = require("expo-modules-core");
delete (NativeModulesProxy as Record<string, unknown>).ExpoObserve;

// React Query defers observer notifications behind a setTimeout(0), so an update
// can land after the test that caused it has finished and its act() scope has
// closed — surfacing as "not wrapped in act(...)" noise under a full suite run.
// Flushing synchronously keeps every notification inside the caller's act().
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("@tanstack/react-query").notifyManager.setScheduler(
  (callback: () => void) => callback(),
);

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
