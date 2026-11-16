import { createDismissedDayStore } from "./dismissedDayStorage";

// The day the user said "not now" to the rollover card, so it waits until tomorrow.
const store = createDismissedDayStore("pacetasks.rollover.dismissedDay", "rolloverStorage");

export const loadRolloverDismissedDay = store.load;
export const saveRolloverDismissedDay = store.save;
export const clearRolloverDismissedDay = store.clear;
