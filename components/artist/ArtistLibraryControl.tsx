import { useRef } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ArtistLibraryCapsule } from "@/components/artist/ArtistLibraryCapsule";
import { MonitoringForm } from "@/components/artist/MonitoringForm";
import { AppSheet } from "@/components/ui/AppSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Radius } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useArtistMonitoring,
  useSetArtistMonitoring,
} from "@/hooks/library/use-artist-monitoring";
import { useColors } from "@/hooks/use-colors";
import {
  describeMonitoringRules,
  monitoringChoice,
  type MonitoringChoice,
} from "@/lib/monitoring-rules";

const CAPSULE_PLACEHOLDER = { width: 196, height: 28 };

type ArtistLibraryControlProps = {
  mbid: string;
  artistName: string;
  /** Omit to leave Remove from Library out of the menu. */
  onRemove?: () => void;
};

/**
 * A Library artist's state in one capsule: that it's in the Library, how it's
 * monitored, and a menu to change the monitoring or remove the artist.
 */
export function ArtistLibraryControl({
  mbid,
  artistName,
  onRemove,
}: ArtistLibraryControlProps) {
  const colors = useColors();
  const hasPermission = useHasPermission();
  const canChange = hasPermission("changeMonitoring");
  const { data: state, isPending } = useArtistMonitoring(mbid);
  const change = useSetArtistMonitoring(mbid, artistName);
  const sheetRef = useRef<BottomSheetModal>(null);

  if (isPending) {
    return (
      <Skeleton
        width={CAPSULE_PLACEHOLDER.width}
        height={CAPSULE_PLACEHOLDER.height}
        borderRadius={Radius.round}
      />
    );
  }
  // Shows the pick at once. A refused change falls back to the server's.
  const choice = !state?.added
    ? null
    : change.isPending && change.variables
      ? monitoringChoice(change.variables)
      : monitoringChoice(state);

  const select = (next: MonitoringChoice) => {
    if (next === "custom") {
      sheetRef.current?.present();
      return;
    }
    if (next === choice || change.isPending) return;
    change.mutate(
      next === "off"
        ? { monitored: false }
        : { monitored: true, useDefault: true },
    );
  };

  const customRules =
    state?.added && state.monitored && !state.useDefault ? state.rules : null;

  return (
    <>
      <ArtistLibraryCapsule
        choice={choice}
        defaultSummary={
          state?.added ? describeMonitoringRules(state.defaultRules) : ""
        }
        customSummary={
          customRules ? describeMonitoringRules(customRules) : null
        }
        onSelect={canChange && choice ? select : undefined}
        onRemove={onRemove}
        triggerColor={colors.text}
      />
      {state?.added ? (
        <AppSheet
          ref={sheetRef}
          snapPoints={["85%"]}
          enablePanDownToClose
          enableDynamicSizing={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
        >
          <MonitoringForm
            title="Monitoring"
            artistName={artistName}
            defaultRules={state.defaultRules}
            initialChoice="custom"
            initialRules={customRules}
            offDescription="Nothing new downloads"
            submitLabel="Save"
            submitIcon="checkmark"
            submitting={change.isPending}
            onSubmit={(monitoring) =>
              change.mutate(monitoring, {
                onSuccess: () => sheetRef.current?.dismiss(),
              })
            }
          />
        </AppSheet>
      ) : null}
    </>
  );
}
