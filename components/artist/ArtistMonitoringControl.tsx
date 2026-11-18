import { useRef } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MonitoringCapsule } from "@/components/artist/MonitoringCapsule";
import { MonitoringForm } from "@/components/artist/MonitoringForm";
import { AppSheet } from "@/components/ui/AppSheet";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Radius } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useArtistMonitoring,
  useSetArtistMonitoring,
} from "@/hooks/library/use-artist-monitoring";
import { useColors } from "@/hooks/use-colors";
import {
  MONITORING_CHOICE_LABELS,
  describeMonitoringRules,
  monitoringChoice,
  type MonitoringChoice,
} from "@/lib/monitoring-rules";

const CAPSULE_PLACEHOLDER = { width: 124, height: 28 };

type ArtistMonitoringControlProps = {
  mbid: string;
  artistName: string;
};

/**
 * A Library artist's monitoring under the hero's actions. Default Rules and
 * Not Monitored apply from the menu; Custom Rules opens the rules in a sheet.
 */
export function ArtistMonitoringControl({
  mbid,
  artistName,
}: ArtistMonitoringControlProps) {
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
  if (!state?.added) return null;

  // Shows the pick at once. A refused change falls back to the server's.
  const choice =
    change.isPending && change.variables
      ? monitoringChoice(change.variables)
      : monitoringChoice(state);

  if (!canChange) {
    return (
      <Chip
        label={MONITORING_CHOICE_LABELS[choice]}
        icon={choice === "off" ? "eye-off-outline" : "eye-outline"}
        accessibilityLabel={`Monitoring, ${MONITORING_CHOICE_LABELS[choice]}`}
      />
    );
  }

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

  const customRules = state.monitored && !state.useDefault ? state.rules : null;

  return (
    <>
      <MonitoringCapsule
        choice={choice}
        defaultSummary={describeMonitoringRules(state.defaultRules)}
        customSummary={
          customRules ? describeMonitoringRules(customRules) : null
        }
        onSelect={select}
        triggerColor={colors.text}
      />
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
    </>
  );
}
