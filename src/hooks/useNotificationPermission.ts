import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { getNotificationPermission, NotificationPermission } from "../lib/notifications";

// What iOS allows right now, re-read whenever the app returns (the user may have
// changed it in the phone's Settings) and on demand after the app asked.
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>("undetermined");

  const refresh = useCallback(() => {
    getNotificationPermission()
      .then(setPermission)
      .catch((e) => console.warn("[useNotificationPermission] could not read the permission", e));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { permission, refresh };
}
