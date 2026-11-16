import { FieldGroup, Host } from "@expo/ui";
import {
  formatAt,
  formatValue,
  TRANSCODE_BITRATE_CHOICES,
  TRANSCODE_FORMAT_CHOICES,
} from "@/components/settings/playback";
import { SettingsPicker } from "@/components/settings/SettingsPicker";
import {
  SettingsNote,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { SettingsSwitch } from "@/components/settings/SettingsSwitch";
import {
  getPlaybackSettings,
  setPlaybackSettings,
  usePlaybackSettings,
} from "@/lib/player/playback-settings";
import type { TranscodeProfile } from "@/lib/player/transcoding";

export function TranscodingProfileScreen({
  network,
}: {
  network: "cellular" | "wifi";
}) {
  const row = useSettingsRow();
  const profile = usePlaybackSettings().transcoding[network];
  const update = (change: Partial<TranscodeProfile>) => {
    const { transcoding } = getPlaybackSettings();
    setPlaybackSettings({
      transcoding: {
        ...transcoding,
        [network]: { ...transcoding[network], ...change },
      },
    });
  };

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          {row({
            label: "Transcode Format",
            trailing: (
              <SettingsPicker
                accessibilityLabel="Transcode Format"
                options={TRANSCODE_FORMAT_CHOICES}
                value={formatValue(profile.format)}
                onChange={(value) => update({ format: formatAt(value) })}
              />
            ),
          })}
          {row({
            label: "Bitrate",
            trailing: (
              <SettingsPicker
                accessibilityLabel="Bitrate"
                options={TRANSCODE_BITRATE_CHOICES}
                value={profile.kbps}
                onChange={(kbps) => update({ kbps })}
              />
            ),
          })}
          {row({
            label: "Only Transcode Lossless Files",
            trailing: (
              <SettingsSwitch
                value={profile.losslessOnly}
                onChange={(losslessOnly) => update({ losslessOnly })}
              />
            ),
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote>
              Changes apply from the next track. If the server can’t convert a
              track, Pocket uses the original stream.
            </SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
