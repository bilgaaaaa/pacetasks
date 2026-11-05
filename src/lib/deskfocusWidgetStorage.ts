// The App Group shared with the Deskfocus widget (targets/deskfocus). Only iOS builds have it: everywhere
// else (web demo, tests, Android) every call is a quiet no-op.
import { Platform } from "react-native";
import type { WidgetPaceTask } from "./deskfocusWidget";

// Must match DeskfocusConstants in targets/deskfocus/_shared/Support/DeskfocusConstants.swift.
const APP_GROUP = "group.com.pacetasks.app";
const WIDGET_KIND = "DeskfocusWidget";
const PACE_TASKS_KEY = "deskfocus.paceTasks";
const COMPLETED_IDS_KEY = "deskfocus.completedPaceTaskIds";

type ExtensionStorageClass = typeof import("@bacons/apple-targets").ExtensionStorage;

// Loaded lazily so non-iOS bundles never touch the native module.
function extensionStorage(): ExtensionStorageClass | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("@bacons/apple-targets").ExtensionStorage as ExtensionStorageClass;
  } catch (e) {
    console.warn("[deskfocusWidgetStorage] native module unavailable", e);
    return null;
  }
}

// Hands today's tasks to the widget and asks it to redraw.
export function writeWidgetTasks(tasks: WidgetPaceTask[]): void {
  const Storage = extensionStorage();
  if (!Storage) return;
  try {
    new Storage(APP_GROUP).set(PACE_TASKS_KEY, JSON.stringify(tasks));
    Storage.reloadWidget(WIDGET_KIND);
    console.log(`[deskfocusWidgetStorage] wrote ${tasks.length} tasks`);
  } catch (e) {
    console.warn("[deskfocusWidgetStorage] write failed", e);
  }
}

// The raw JSON list of task ids checked off in the widget, or null when there is none.
export function readWidgetCompletions(): string | null {
  const Storage = extensionStorage();
  if (!Storage) return null;
  try {
    return new Storage(APP_GROUP).get(COMPLETED_IDS_KEY);
  } catch (e) {
    console.warn("[deskfocusWidgetStorage] read failed", e);
    return null;
  }
}

// Redraws the widget, e.g. right after calendar access was granted.
export function reloadWidget(): void {
  const Storage = extensionStorage();
  if (!Storage) return;
  try {
    Storage.reloadWidget(WIDGET_KIND);
  } catch (e) {
    console.warn("[deskfocusWidgetStorage] reload failed", e);
  }
}
