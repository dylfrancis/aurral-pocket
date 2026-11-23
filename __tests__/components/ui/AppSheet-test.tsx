// As on iOS, the content stays mounted while the sheet slides away, and
// unmounts only once the slide has finished, which the test decides.
let mockFinishClosing: (() => void) | null = null;
jest.mock("@expo/ui", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BottomSheet: function BottomSheet({
      isPresented,
      children,
    }: {
      isPresented: boolean;
      children: React.ReactNode;
    }) {
      const [mounted, setMounted] = React.useState(isPresented);
      if (isPresented && !mounted) setMounted(true);
      React.useEffect(() => {
        mockFinishClosing = isPresented ? null : () => setMounted(false);
      }, [isPresented]);
      return mounted ? React.createElement(View, null, children) : null;
    },
    RNHostView: ({ children }: { children: React.ReactElement }) => children,
  };
});

import { Pressable, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppSheet, useSheet } from "@/components/ui/AppSheet";

function OpenSheet({
  after,
  onClosed,
}: {
  after: () => void;
  onClosed: () => void;
}) {
  const sheet = useSheet({ presented: true, onClosed });
  return (
    <>
      <Pressable
        accessibilityLabel="Close"
        onPress={() => sheet.close(after)}
      />
      <AppSheet sheet={sheet}>
        <Text>Sheet content</Text>
      </AppSheet>
    </>
  );
}

it("runs what follows a close only once the sheet has gone", async () => {
  const after = jest.fn();
  const onClosed = jest.fn();
  await render(<OpenSheet after={after} onClosed={onClosed} />);

  await fireEvent.press(screen.getByLabelText("Close"));

  // Still sliding away, when iOS would refuse another sheet or an alert.
  expect(screen.getByText("Sheet content")).toBeTruthy();
  expect(after).not.toHaveBeenCalled();
  expect(onClosed).not.toHaveBeenCalled();

  await act(() => mockFinishClosing?.());

  expect(screen.queryByText("Sheet content")).toBeNull();
  expect(after).toHaveBeenCalledTimes(1);
  expect(onClosed).toHaveBeenCalledTimes(1);
});
