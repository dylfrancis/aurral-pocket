import {
  requireOptionalNativeModule,
  type EventSubscription,
} from "expo-modules-core";

import type {
  SiriFindAnswer,
  SiriModuleEvents,
  SiriPlayAnswer,
  SiriRequest,
} from "./src/Siri.types";

export type {
  SiriFindAnswer,
  SiriFindRequest,
  SiriItem,
  SiriItemType,
  SiriMediaType,
  SiriPlayAnswer,
  SiriPlayRequest,
  SiriRequest,
  SiriSearch,
  SiriSuggestion,
} from "./src/Siri.types";

type SiriNativeModule = {
  answer(id: string, answer: SiriFindAnswer | SiriPlayAnswer): void;
  setPlaylistNames(names: string[]): void;
  setLibrarySize(songCount: number): void;
  forgetAccount(): void;
  addListener<E extends keyof SiriModuleEvents>(
    event: E,
    listener: SiriModuleEvents[E],
  ): EventSubscription;
};

/** Null off iOS: Android and web have no Siri. */
const SiriModule = requireOptionalNativeModule<SiriNativeModule>("Siri");

export const isSiriAvailable = SiriModule != null;

export function addRequestListener(
  listener: (request: SiriRequest) => void,
): EventSubscription | null {
  return SiriModule?.addListener("onRequest", listener) ?? null;
}

export function answer(
  id: string,
  reply: SiriFindAnswer | SiriPlayAnswer,
): void {
  SiriModule?.answer(id, reply);
}

export function setPlaylistNames(names: string[]): void {
  SiriModule?.setPlaylistNames(names);
}

export function setLibrarySize(songCount: number): void {
  SiriModule?.setLibrarySize(songCount);
}

/** Drops the signed-out account's playlist names and played items. */
export function forgetAccount(): void {
  SiriModule?.forgetAccount();
}
