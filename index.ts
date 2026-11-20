import "expo-router/entry";
import { listenForSiri } from "@/hooks/siri/listen-for-siri";

// When Siri wakes the app, no window opens, so the router never renders and
// no screen mounts. Only what this file starts runs, so Siri is answered from
// here.
listenForSiri();
