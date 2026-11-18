import type { TaskTime } from "@domain/taskTime";
import { t } from "../i18n";

// How a task's time reads in lists and sheets: "19:30", "after 20:00", "before 18:00", "19:00–21:00".
// Anytime has no label, so rows without a time stay short.
export function taskTimeLabel(time: TaskTime): string | null {
  switch (time.kind) {
    case "any":
      return null;
    case "at":
      return time.time;
    case "after":
      return t("after {0}", time.start);
    case "before":
      return t("before {0}", time.end);
    case "between":
      return t("{0}–{1}", time.start, time.end);
  }
}

// The same time as a whole phrase for screen readers: "between 19:00 and 21:00".
export function taskTimeSpoken(time: TaskTime): string {
  switch (time.kind) {
    case "any":
      return t("any time");
    case "at":
      return t("at {0}", time.time);
    case "after":
      return t("after {0}", time.start);
    case "before":
      return t("before {0}", time.end);
    case "between":
      return t("between {0} and {1}", time.start, time.end);
  }
}
