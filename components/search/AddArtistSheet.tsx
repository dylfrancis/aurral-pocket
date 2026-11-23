import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { MonitoringForm } from "@/components/artist/MonitoringForm";
import { AppSheet, type Sheet } from "@/components/ui/AppSheet";
import { useMonitoringDefaults } from "@/hooks/library/use-artist-monitoring";
import { useAddArtist } from "@/hooks/search/use-add-artist";
import { ApiError } from "@/lib/api/client";
import { describeMonitoringPlan } from "@/lib/monitoring-rules";
import type { ArtistMonitoring } from "@/lib/types/monitoring";

type AddArtistSheetProps = {
  mbid: string;
  artistName: string;
  sheet: Sheet;
  onAdded?: () => void;
};

export function AddArtistSheet({
  mbid,
  artistName,
  sheet,
  onAdded,
}: AddArtistSheetProps) {
  return (
    <AppSheet sheet={sheet} snapPoints={["full"]}>
      <AddArtistForm
        mbid={mbid}
        artistName={artistName}
        onAdded={() => sheet.close(onAdded)}
      />
    </AppSheet>
  );
}

function AddArtistForm({
  mbid,
  artistName,
  onAdded,
}: {
  mbid: string;
  artistName: string;
  onAdded: () => void;
}) {
  const defaults = useMonitoringDefaults();
  const addArtist = useAddArtist(
    (data, { monitoring }) => {
      Burnt.toast({
        title: `Added ${artistName}`,
        message: monitoring.monitored
          ? describeMonitoringPlan(data.artist?.monitoring, data.artist?.rules)
          : undefined,
        preset: "done",
      });
      onAdded();
    },
    (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: `Couldn't add ${artistName}`,
        message: error instanceof ApiError ? error.message : undefined,
        preset: "error",
      });
    },
  );

  const add = (monitoring: ArtistMonitoring) =>
    addArtist.mutate({ foreignArtistId: mbid, artistName, monitoring });

  return (
    <MonitoringForm
      title="Add to Library"
      artistName={artistName}
      defaultRules={defaults.data?.rules}
      defaultsFailed={defaults.isError}
      initialChoice="default"
      offDescription="Artist only, nothing downloads"
      submitLabel="Add to Library"
      submitIcon="add"
      submitting={addArtist.isPending}
      submitted={addArtist.isSuccess}
      submittedLabel="Added"
      onSubmit={add}
    />
  );
}
