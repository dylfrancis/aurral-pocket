import * as Burnt from "burnt";
import { useEffect, useReducer } from "react";
import { StyleSheet, View } from "react-native";
import { DevicesMenu } from "@/components/player/DevicesMenu";
import { formatTime } from "@/components/player/Scrubber";
import {
  pickUpQueue,
  useOtherDevice,
  type OtherDevice,
} from "@/lib/player/queue-sync";

type DevicesButtonProps = {
  color: string;
  /** For while there's a queue to pick up, as shuffle shows it's on. */
  activeColor: string;
};

/**
 * Lists the queue another device left, to pick up here. It turns the active
 * color while there's one; nothing is offered unasked.
 */
export function DevicesButton({ color, activeColor }: DevicesButtonProps) {
  const device = useOtherDevice();
  useMinuteTicks(device !== null);

  const pickUp = () => {
    if (!device) return;
    pickUpQueue().catch(() => {
      // Android shows a toast's title alone.
      Burnt.toast({
        title: `Couldn't play from ${device.name}`,
        preset: "error",
      });
    });
  };

  return (
    <View style={styles.button}>
      <DevicesMenu
        device={device && { name: device.name, detail: deviceDetail(device) }}
        onPickUp={pickUp}
        triggerColor={device ? activeColor : color}
        accessibilityLabel={
          device ? `Devices. ${device.name} has a queue to pick up.` : "Devices"
        }
      />
    </View>
  );
}

/** As in "Roads · 2:14 · 1 min ago". */
function deviceDetail(device: OtherDevice): string {
  const at = formatTime(device.positionSeconds);
  return `${device.track.title} · ${at} · ${savedAgo(device.savedAt)}`;
}

/** The phone's clock can be a little off the server's, so the future is now. */
function savedAgo(savedAt: number): string {
  const minutes = Math.floor(Math.max(0, Date.now() - savedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Renders again every half minute while `on`, so "1 min ago" moves on. */
function useMinuteTicks(on: boolean): void {
  const [, tick] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [on]);
}

const styles = StyleSheet.create({
  // The toolbar's button size, so it lines up with Lyrics and Queue.
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
