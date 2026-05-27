import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  useFocusEffect,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import * as Burnt from "burnt";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { RequestRow } from "@/components/requests/RequestRow";
import { RequestActionsSheet } from "@/components/requests/RequestActionsSheet";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { useRequestsSuspense } from "@/hooks/requests/use-requests";
import { useRequestsDownloadStatuses } from "@/hooks/requests/use-requests-download-statuses";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { Request } from "@/lib/types/requests";

const LIST_PADDING_HORIZONTAL = 16;
const LIST_PADDING_VERTICAL = 12;

export default function RequestsScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const hasPermission = useHasPermission();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<Request | null>(null);

  const { data: requests, refetch } = useRequestsSuspense();
  const { data: downloadStatuses } = useRequestsDownloadStatuses(requests);

  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      const result = await refetch();
      if (result.isError) {
        Burnt.toast({
          title: "Couldn't refresh requests",
          preset: "error",
        });
      }
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const rowHasActions = useCallback(
    (request: Request) => {
      if (!request.albumId) return false;
      const albumStatus = downloadStatuses?.[String(request.albumId)]?.status;
      const isFailed = albumStatus === "failed" || request.status === "failed";
      const canStop = request.inQueue && hasPermission("deleteAlbum");
      return canStop || isFailed;
    },
    [downloadStatuses, hasPermission],
  );

  const handleRowPress = useCallback(
    (request: Request) => {
      if (!request.artistMbid) return;
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: request.artistMbid },
      });
    },
    [router],
  );

  const handleLongPress = useCallback((request: Request) => {
    setSelected(request);
    sheetRef.current?.present();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Request }) => (
      <RequestRow
        request={item}
        downloadStatus={
          item.albumId
            ? downloadStatuses?.[String(item.albumId)]?.status
            : undefined
        }
        hasActions={rowHasActions(item)}
        onPress={() => handleRowPress(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [downloadStatuses, rowHasActions, handleRowPress, handleLongPress],
  );

  const activeStatus = selected?.albumId
    ? downloadStatuses?.[String(selected.albumId)]?.status
    : undefined;

  return (
    <>
      <FlashList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            message="No requests yet"
            actionLabel="Start Discovering"
            onAction={() => router.push("/(app)/(tabs)/(discover)")}
          />
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={colors.brand}
          />
        }
      />
      <RequestActionsSheet
        sheetRef={sheetRef}
        request={selected}
        downloadStatus={activeStatus}
      />
    </>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ScreenCenter>
      <EmptyState
        icon="cloud-offline-outline"
        message="Failed to load requests"
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
  );
}

function ItemSeparator() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: LIST_PADDING_HORIZONTAL,
    paddingVertical: LIST_PADDING_VERTICAL,
  },
});
