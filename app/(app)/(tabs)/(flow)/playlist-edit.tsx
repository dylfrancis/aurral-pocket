import { useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  useJobsForPlaylist,
  useSharedPlaylist,
  useUpdateSharedPlaylist,
} from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

const trackSchema = z.object({
  artistName: z.string(),
  trackName: z.string(),
  albumName: z.string().nullable().optional(),
  artistMbid: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

const playlistEditSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tracks: z.array(trackSchema).min(1, "Add at least one track"),
});

type PlaylistEditForm = z.infer<typeof playlistEditSchema>;

export default function PlaylistEditScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const playlistId = typeof params.id === "string" ? params.id : null;

  const playlist = useSharedPlaylist(playlistId ?? undefined);
  const jobs = useJobsForPlaylist(playlistId ?? undefined);
  const update = useUpdateSharedPlaylist();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaylistEditForm>({
    resolver: zodResolver(playlistEditSchema),
    defaultValues: { name: "", tracks: [] },
  });

  const { fields, move, remove } = useFieldArray({
    control,
    name: "tracks",
  });

  useEffect(() => {
    if (!playlist) return;
    const sourceTracks: SharedPlaylistTrack[] =
      playlist.tracks && playlist.tracks.length > 0
        ? playlist.tracks
        : jobs.map((job) => ({
            artistName: job.artistName,
            trackName: job.trackName,
            albumName: job.albumName ?? null,
            artistMbid: job.artistMbid ?? null,
            reason: job.reason ?? null,
          }));
    reset({ name: playlist.name, tracks: sourceTracks });
  }, [playlist, jobs, reset]);

  const isPending = update.isPending;

  const onSubmit = (values: PlaylistEditForm) => {
    if (!playlistId) return;
    update.mutate(
      { playlistId, payload: values },
      {
        onSuccess: () => router.back(),
        onError: (err: any) =>
          Alert.alert("Could not save", err?.message ?? "Try again."),
      },
    );
  };

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
      <Stack.Screen options={{ title: "Edit Playlist" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Card bordered radius={14} style={styles.section}>
          <Text
            variant="subtitle"
            style={[
              styles.sectionTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            Name
          </Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Playlist name"
                autoCapitalize="words"
              />
            )}
          />
          {errors.name?.message ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {errors.name.message}
            </Text>
          ) : null}
        </Card>

        <Card bordered radius={14} style={styles.section}>
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
            <Text variant="caption">{fields.length} total</Text>
          </View>
          {fields.length === 0 ? (
            <Text variant="caption">No tracks. Add some from the web app.</Text>
          ) : (
            <View style={styles.trackList}>
              {fields.map((track, index) => (
                <View
                  key={track.id}
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
                      onPress={() => move(index, index - 1)}
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
                      onPress={() => move(index, index + 1)}
                      disabled={index === fields.length - 1}
                      style={({ pressed }) => [
                        styles.trackButton,
                        {
                          opacity:
                            pressed || index === fields.length - 1 ? 0.4 : 1,
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
          {errors.tracks?.message ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {errors.tracks.message}
            </Text>
          ) : null}
        </Card>

        <Button
          title="Save Changes"
          onPress={handleSubmit(onSubmit)}
          loading={isPending}
        />
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
});
