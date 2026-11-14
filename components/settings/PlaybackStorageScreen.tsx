import { FieldGroup, Host } from "@expo/ui";
import { useState } from "react";
import {
  CACHE_SIZE_CHOICES,
  PREFETCH_CHOICES,
  QUEUE_LIMIT_CHOICES,
} from "@/components/settings/playback";
import { SettingsPicker } from "@/components/settings/SettingsPicker";
import {
  SettingsNote,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { SettingsSwitch } from "@/components/settings/SettingsSwitch";
import { clearAudioCache, useCachedBytes } from "@/lib/offline/audio-cache";
import { formatBytes } from "@/lib/offline/format";
import { useSavedBytes } from "@/lib/offline/saved-library";
import {
  setPlaybackSettings,
  usePlaybackSettings,
} from "@/lib/player/playback-settings";

export function PlaybackStorageScreen() {
  const row = useSettingsRow();
  const settings = usePlaybackSettings();
  const cachedBytes = useCachedBytes();
  const savedBytes = useSavedBytes();
  const [clearing, setClearing] = useState(false);

  const clear = () => {
    setClearing(true);
    clearAudioCache().finally(() => setClearing(false));
  };

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Playback">
          {row({
            label: "Prefetch Ahead",
            trailing: (
              <SettingsPicker
                accessibilityLabel="Prefetch Ahead"
                value={settings.prefetchAhead}
                options={PREFETCH_CHOICES}
                onChange={(prefetchAhead) =>
                  setPlaybackSettings({ prefetchAhead })
                }
              />
            ),
          })}
          {row({
            label: "Queue Length",
            trailing: (
              <SettingsPicker
                accessibilityLabel="Queue Length"
                value={settings.queueLimit}
                options={QUEUE_LIMIT_CHOICES}
                onChange={(queueLimit) => setPlaybackSettings({ queueLimit })}
              />
            ),
          })}
          {row({
            label: "Wi-Fi Only",
            trailing: (
              <SettingsSwitch
                value={settings.wifiOnly}
                onChange={(wifiOnly) => setPlaybackSettings({ wifiOnly })}
              />
            ),
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote>
              Prefetch keeps the next tracks on your phone while one plays, so a
              drop in signal doesn’t stop the music. With Wi-Fi Only, prefetch
              and offline saves wait for Wi-Fi.
            </SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
        <FieldGroup.Section title="Storage">
          {row({
            label: "Cache Size",
            trailing: (
              <SettingsPicker
                accessibilityLabel="Cache Size"
                value={settings.cacheBytes}
                options={CACHE_SIZE_CHOICES}
                onChange={(cacheBytes) => setPlaybackSettings({ cacheBytes })}
              />
            ),
          })}
          {row({ label: "Cache", value: formatBytes(cachedBytes) })}
          {row({ label: "Saved Offline", value: formatBytes(savedBytes) })}
          {row({
            key: "clear-cache",
            label: clearing ? "Clearing…" : "Clear Cache",
            action: true,
            disabled: clearing || cachedBytes === 0,
            onPress: clear,
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote>
              Clearing keeps the track that’s playing and fetches again from the
              next one. What you saved offline stays.
            </SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
