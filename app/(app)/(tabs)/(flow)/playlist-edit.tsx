import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  useJobsForPlaylist,
  useSharedPlaylist,
  useUpdateSharedPlaylist,
} from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

type EditableTrack = SharedPlaylistTrack & { key: string };

function makeKey(track: SharedPlaylistTrack, index: number): string {
  return `${track.artistName}|${track.trackName}|${track.albumName ?? ""}|${index}`;
}

export default function PlaylistEditScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const playlistId = typeof params.id === "string" ? params.id : null;

  const playlist = useSharedPlaylist(playlistId ?? undefined);
  const jobs = useJobsForPlaylist(playlistId ?? undefined);
  const update = useUpdateSharedPlaylist();

  const [name, setName] = useState("");
  const [tracks, setTracks] = useState<EditableTrack[]>([]);

  useEffect(() => {
    if (!playlist) return;
    setName(playlist.name);
  }, [playlist]);

  useEffect(() => {
    if (!playlist) return;
    const sourceTracks =
      playlist.tracks && playlist.tracks.length > 0
        ? playlist.tracks
        : jobs.map<SharedPlaylistTrack>((job) => ({
            artistName: job.artistName,
            trackName: job.trackName,
            albumName: job.albumName ?? null,
            artistMbid: job.artistMbid ?? null,
            reason: job.reason ?? null,
          }));
    setTracks(sourceTracks.map((t, idx) => ({ ...t, key: makeKey(t, idx) })));
  }, [playlist, jobs]);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setTracks((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return next;
    });
  };

  const moveDown = (index: number) => {
    setTracks((current) => {
      if (index >= current.length - 1) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item);
      return next;
    });
  };

  const remove = (index: number) => {
    setTracks((current) => current.filter((_, i) => i !== index));
  };

  const isPending = update.isPending;

  const handleSave = () => {
    if (!playlistId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Give your playlist a name before saving.");
      return;
    }
    if (tracks.length === 0) {
      Alert.alert(
        "No tracks",
        "Add at least one track before saving the playlist.",
      );
      return;
    }
    const payload = {
      name: trimmed,
      tracks: tracks.map<SharedPlaylistTrack>(({ key: _key, ...t }) => t),
    };
    update.mutate(
      { playlistId, payload },
      {
        onSuccess: () => router.back(),
        onError: (err: any) =>
          Alert.alert("Could not save", err?.message ?? "Try again."),
      },
    );
  };

  const sectionStyle = useMemo(
    () => [
      styles.section,
      { backgroundColor: colors.card, borderColor: colors.separator },
    ],
    [colors.card, colors.separator],
  );

  if (!playlist) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text variant="body">Playlist not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <Stack.Screen
        options={{
          title: "Edit Playlist",
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={isPending}
              style={({ pressed }) => [
                styles.headerButton,
                { opacity: pressed || isPending ? 0.5 : 1 },
              ]}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text
                  variant="body"
                  style={{ color: colors.text, fontFamily: Fonts.semiBold }}
                >
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={sectionStyle}>
          <Text
            variant="subtitle"
            style={[
              styles.sectionTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            Name
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Playlist name"
            autoCapitalize="words"
          />
        </View>

        <View style={sectionStyle}>
          <View style={styles.tracksHead}>
            <Text
              variant="subtitle"
              style={[
                styles.sectionTitle,
                { color: colors.text, fontFamily: Fonts.semiBold },
              ]}
            >
              Tracks
            </Text>
            <Text variant="caption">{tracks.length} total</Text>
          </View>
          {tracks.length === 0 ? (
            <Text variant="caption">No tracks. Add some from the web app.</Text>
          ) : (
            <View style={styles.trackList}>
              {tracks.map((track, index) => (
                <View
                  key={track.key}
                  style={[styles.trackRow, { borderColor: colors.separator }]}
                >
                  <View style={styles.trackBody}>
                    <Text
                      variant="body"
                      numberOfLines={1}
                      style={{ fontFamily: Fonts.medium }}
                    >
                      {track.trackName}
                    </Text>
                    <Text variant="caption" numberOfLines={1}>
                      {track.albumName
                        ? `${track.artistName} · ${track.albumName}`
                        : track.artistName}
                    </Text>
                  </View>
                  <View style={styles.trackActions}>
                    <Pressable
                      onPress={() => moveUp(index)}
                      disabled={index === 0}
                      style={({ pressed }) => [
                        styles.trackButton,
                        { opacity: pressed || index === 0 ? 0.4 : 1 },
                      ]}
                      accessibilityLabel="Move up"
                    >
                      <Ionicons
                        name="chevron-up"
                        size={18}
                        color={colors.text}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => moveDown(index)}
                      disabled={index === tracks.length - 1}
                      style={({ pressed }) => [
                        styles.trackButton,
                        {
                          opacity:
                            pressed || index === tracks.length - 1 ? 0.4 : 1,
                        },
                      ]}
                      accessibilityLabel="Move down"
                    >
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={colors.text}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => remove(index)}
                      style={({ pressed }) => [
                        styles.trackButton,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                      accessibilityLabel="Remove track"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.error}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <Button title="Save Changes" onPress={handleSave} loading={isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  tracksHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trackList: {
    gap: 0,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackBody: {
    flex: 1,
    gap: 2,
  },
  trackActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trackButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
