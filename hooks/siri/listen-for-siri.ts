import { findForSiri, playForSiri } from "@/hooks/siri/answer-siri";
import { addRequestListener, answer, isSiriAvailable } from "@/modules/siri";

let listening = false;

/** Answer Siri for as long as the app runs. Call it from the app's entry. */
export function listenForSiri(): void {
  if (!isSiriAvailable || listening) return;
  listening = true;
  addRequestListener((request) => {
    if (request.type === "find") {
      void findForSiri(request).then((reply) => answer(request.id, reply));
    } else {
      void playForSiri(request).then((reply) => answer(request.id, reply));
    }
  });
}
