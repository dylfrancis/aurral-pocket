import { requireNativeView } from "expo";
import {
  requireOptionalNativeModule,
  type EventSubscription,
} from "expo-modules-core";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";

/**
 * Where the audio plays. "remote" is AirPlay on iOS and a Cast or other
 * network device on Android.
 */
export type AudioOutputKind =
  "phone" | "headphones" | "remote" | "speaker" | "tv" | "car";

export type AudioOutput = {
  kind: AudioOutputKind;
  /** As the system names it: "iPhone", "This phone", "AirPods Pro". */
  name: string;
};

/**
 * How the output is changed: AirPlay's button laid over a label (iOS), the
 * system's output switcher (Android 11 and later), or not at all.
 */
export type OutputPicker = "view" | "switcher" | "none";

type AudioOutputNativeModule = {
  picker: OutputPicker;
  getCurrentOutput(): Promise<AudioOutput | null>;
  /** Android only. False when the system has no switcher to show. */
  showOutputPicker?(): Promise<boolean>;
  addListener(
    event: "onOutputChange",
    listener: (event: { output: AudioOutput | null }) => void,
  ): EventSubscription;
};

/** Null on web and in Expo Go. */
const AudioOutputModule =
  requireOptionalNativeModule<AudioOutputNativeModule>("AudioOutput");

export const outputPicker: OutputPicker = AudioOutputModule?.picker ?? "none";

/** Null while a route has no outputs, which happens only mid-change. */
export function getCurrentOutput(): Promise<AudioOutput | null> {
  return AudioOutputModule?.getCurrentOutput() ?? Promise.resolve(null);
}

export function addOutputListener(
  listener: (output: AudioOutput | null) => void,
): EventSubscription | null {
  return (
    AudioOutputModule?.addListener("onOutputChange", ({ output }) =>
      listener(output),
    ) ?? null
  );
}

export function showOutputPicker(): Promise<boolean> {
  return AudioOutputModule?.showOutputPicker?.() ?? Promise.resolve(false);
}

/**
 * AirPlay's picker button, drawn clear. Lay it over the label it opens from.
 * Null unless `outputPicker` is "view".
 */
export const OutputPickerView: ComponentType<ViewProps> | null =
  outputPicker === "view" ? requireNativeView("AudioOutput") : null;
