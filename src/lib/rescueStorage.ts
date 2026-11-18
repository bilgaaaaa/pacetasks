import { createDismissedDayStore } from "./dismissedDayStorage";

// The day the user said "not now" to Rescue my day, so it waits until tomorrow.
const store = createDismissedDayStore("pacetasks.rescue.dismissedDay", "rescueStorage");

export const loadRescueDismissedDay = store.load;
export const saveRescueDismissedDay = store.save;
export const clearRescueDismissedDay = store.clear;
