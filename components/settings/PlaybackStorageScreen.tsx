import { FieldGroup, Host } from "@expo/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  CACHE_SIZE_CHOICES,
  PREFETCH_CHOICES,
  QUEUE_LIMIT_CHOICES,
  formatAt,
  formatValue,
  profileSummary,
  TRANSCODE_FORMAT_CHOICES,
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
  const router = useRouter();
  const row = useSettingsRow();
  const settings = usePlaybackSettings();
  const cachedBytes = useCachedBytes();
  const savedBytes = useSavedBytes();
  const [clearing, setClearing] = useState(false);
  const profiles = settings.transcoding;

  const clear = () => {
    setClearing(true);
    clearAudioCache().finally(() => setClearing(false));
  };

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Transcoding">
          {row({
            label: "Cellular",
            value: profileSummary(profiles.cellular),
            opensPage: true,
            onPress: () =>
              router.push({
                pathname: "/settings/playback/[network]",
                params: { network: "cellular" },
              }),
          })}
          {row({
            label: "Wi-Fi",
            value: profileSummary(profiles.wifi),
            opensPage: true,
            onPress: () =>
              router.push({
                pathname: "/settings/playback/[network]",
                params: { network: "wifi" },
              }),
          })}
          {row({
            label: "Prefer Lossless on Wi-Fi",
            trailing: (
              <SettingsSwitch
                value={profiles.preferLosslessOnWifi}
                onChange={(preferLosslessOnWifi) =>
                  setPlaybackSettings({
                    transcoding: { ...profiles, preferLosslessOnWifi },
                  })
                }
              />
            ),
          })}
          {row({
            label: "Transcoding Fallback",
            trailing: (
              <SettingsPicker
                accessibilityLabel="Transcoding Fallback"
                value={formatValue(profiles.fallbackFormat)}
                options={TRANSCODE_FORMAT_CHOICES}
                onChange={(value) =>
                  setPlaybackSettings({
                    transcoding: {
                      ...profiles,
                      fallbackFormat: formatAt(value),
                    },
                  })
                }
              />
            ),
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote>
              Server Default uses Aurral’s usual streams. The fallback format is
              for files Pocket can’t play directly. Transcoding uses your
              existing session on supported Aurral servers. Offline saves keep
              their original quality.
            </SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
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
          {row({
            label: "Autoplay",
            trailing: (
              <SettingsSwitch
                value={settings.autoplay}
                onChange={(autoplay) => setPlaybackSettings({ autoplay })}
              />
            ),
          })}
          {row({
            label: "Level Loud Tracks",
            trailing: (
              <SettingsSwitch
                value={settings.levelLoudTracks}
                onChange={(levelLoudTracks) =>
                  setPlaybackSettings({ levelLoudTracks })
                }
              />
            ),
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote>
              Prefetch keeps the next tracks on your phone while one plays, so a
              drop in signal doesn’t stop the music. With Wi-Fi Only, prefetch
              and offline saves wait for Wi-Fi. When the queue ends, Autoplay
              keeps playing similar music from your Library. Level Loud Tracks
              turns down tracks Aurral measures as loud, and never turns a quiet
              one up.
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
