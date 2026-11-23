import { useEffect, useState } from "react";
import { useAndroidAutoConnected } from "@/lib/player/player";
import {
  addOutputListener,
  getCurrentOutput,
  type AudioOutput,
} from "@/modules/audio-output";

const ANDROID_AUTO: AudioOutput = { kind: "car", name: "Android Auto" };

/** Where the audio plays, or null until the system says. */
export function useAudioOutput(): AudioOutput | null {
  const [output, setOutput] = useState<AudioOutput | null>(null);
  const inAndroidAuto = useAndroidAutoConnected();

  useEffect(() => {
    let live = true;
    let changed = false;
    // A route mid-change has no outputs; the last one stays up meanwhile.
    const subscription = addOutputListener((next) => {
      if (!next) return;
      changed = true;
      if (live) setOutput(next);
    });
    // An output that lands first is newer than this read.
    getCurrentOutput().then(
      (first) => {
        if (live && !changed && first) setOutput(first);
      },
      () => {},
    );
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);

  return inAndroidAuto ? ANDROID_AUTO : output;
}
