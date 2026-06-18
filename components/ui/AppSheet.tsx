import React, { forwardRef, useCallback } from "react";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type AppSheetProps = Omit<
  BottomSheetModalProps,
  "backdropComponent" | "backgroundStyle" | "handleIndicatorStyle"
> & {
  /** Sheet surface color. Defaults to the elevated surface. */
  background?: "elevated" | "card";
  /** Backdrop tap behavior. Defaults to closing the sheet. */
  backdropPressBehavior?: "none" | "close" | "collapse";
};

/**
 * BottomSheetModal with the app-standard backdrop, surface color, and
 * handle indicator, so sheet chrome is defined in one place.
 */
export const AppSheet = forwardRef<BottomSheetModal, AppSheetProps>(
  function AppSheet(
    { background = "elevated", backdropPressBehavior = "close", ...rest },
    ref,
  ) {
    const colors = Colors[useColorScheme()];

    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior={backdropPressBehavior}
        />
      ),
      [backdropPressBehavior],
    );

    return (
      <BottomSheetModal
        ref={ref}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor:
            background === "card" ? colors.card : colors.surfaceMid,
        }}
        handleIndicatorStyle={{ backgroundColor: colors.subtle }}
        {...rest}
      />
    );
  },
);
