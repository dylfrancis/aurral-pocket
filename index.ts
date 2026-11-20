import "expo-router/entry";
import { registerCar } from "@/hooks/car/car-screens";
import { listenForSiri } from "@/hooks/siri/listen-for-siri";

// When Siri or a car wakes the app, no window opens, so the router never
// renders and no screen mounts. Only what this file starts runs, so both are
// answered from here.
listenForSiri();
registerCar();
