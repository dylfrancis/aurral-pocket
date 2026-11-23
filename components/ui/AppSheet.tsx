import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewProps,
} from "react-native";
import { BottomSheet, RNHostView, type SnapPoint } from "@expo/ui";
import { IS_IOS } from "@/constants/platform";
import { useColors } from "@/hooks/use-colors";

/**
 * Past this share of the screen, a sheet that fits its content scrolls
 * instead of growing.
 */
const FITTED_MAX_HEIGHT = 0.75;

/**
 * The content pads its own sides. The top keeps each platform's room for the
 * drag indicator: iOS draws it over the content, Android above it.
 */
const CONTENT_PADDING = { top: IS_IOS ? 16 : 0 };

type SheetPhase = "open" | "closing" | "closed";

export type Sheet = {
  /** Whether the sheet is up, or on its way up. */
  isPresented: boolean;
  present: () => void;
  /**
   * Closes the sheet, then runs `after` once it has gone: iOS refuses another
   * sheet or an alert sooner, and a page change could cut the sheet off.
   */
  close: (after?: () => void) => void;
  /** For AppSheet: swiped away, or the backdrop tapped. */
  dismissed: () => void;
  /** For AppSheet: the sheet has gone and its content unmounted. */
  closed: () => void;
};

type SheetOptions = {
  /** Up from the first render, for a sheet mounted only while open. */
  presented?: boolean;
  /** After the sheet has gone, however it closed. */
  onClosed?: () => void;
};

export function useSheet({
  presented = false,
  onClosed,
}: SheetOptions = {}): Sheet {
  const [isPresented, setIsPresented] = useState(presented);
  const phase = useRef<SheetPhase>(presented ? "open" : "closed");
  const pending = useRef<(() => void) | null>(null);
  const onClosedRef = useRef(onClosed);
  useLayoutEffect(() => {
    onClosedRef.current = onClosed;
  });

  const present = useCallback(() => {
    phase.current = "open";
    // A close that hadn't finished still owes what was picked before it.
    const after = pending.current;
    pending.current = null;
    setIsPresented(true);
    after?.();
  }, []);

  const close = useCallback((after?: () => void) => {
    if (phase.current === "closed") {
      after?.();
      return;
    }
    if (after) pending.current = after;
    phase.current = "closing";
    setIsPresented(false);
  }, []);

  const dismissed = useCallback(() => close(), [close]);

  const closed = useCallback(() => {
    // Presented again before the last close finished.
    if (phase.current === "open") return;
    phase.current = "closed";
    const after = pending.current;
    pending.current = null;
    onClosedRef.current?.();
    after?.();
  }, []);

  return useMemo(
    () => ({ isPresented, present, close, dismissed, closed }),
    [isPresented, present, close, dismissed, closed],
  );
}

const FittedContext = createContext(false);

type AppSheetProps = {
  sheet: Sheet;
  /** Heights the sheet rests at. Without them, it fits its content. */
  snapPoints?: SnapPoint[];
  /** Sheet surface color. Defaults to the elevated surface. */
  background?: "elevated" | "card";
  children: ReactNode;
};

/**
 * The platform's own sheet in the app's surface color. Its content mounts only
 * while it's up, and the platform keeps it clear of the home indicator.
 */
export function AppSheet({
  sheet,
  snapPoints,
  background = "elevated",
  children,
}: AppSheetProps) {
  const colors = useColors();
  const fitted = !snapPoints?.length;

  return (
    <BottomSheet
      isPresented={sheet.isPresented}
      onDismiss={sheet.dismissed}
      snapPoints={snapPoints}
      contentPadding={CONTENT_PADDING}
      containerColor={background === "card" ? colors.card : colors.surfaceMid}
    >
      <RNHostView matchContents={fitted ? { vertical: true } : false}>
        <View style={fitted ? undefined : styles.fill}>
          <FittedContext.Provider value={fitted}>
            {children}
          </FittedContext.Provider>
          <ClosedSignal onClosed={sheet.closed} />
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

/**
 * Scrolls a sheet's content: fills a sheet with snap points, and stops a
 * fitted sheet from growing past most of the screen.
 */
export function AppSheetScrollView({ style, ...props }: ScrollViewProps) {
  const fitted = useContext(FittedContext);
  const { height } = useWindowDimensions();
  return (
    <ScrollView
      style={[
        fitted ? { maxHeight: height * FITTED_MAX_HEIGHT } : styles.fill,
        style,
      ]}
      {...props}
    />
  );
}

/** The content unmounts once the sheet has gone, on both platforms. */
function ClosedSignal({ onClosed }: { onClosed: () => void }) {
  const latest = useRef(onClosed);
  useLayoutEffect(() => {
    latest.current = onClosed;
  });
  useEffect(() => () => latest.current(), []);
  return null;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
