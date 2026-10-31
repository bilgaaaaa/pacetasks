import { Alert, Platform } from "react-native";

export interface DestructivePrompt {
  title: string;
  message: string;
  confirmLabel: string;
}

// Asks before something is deleted for good, the same way everywhere: a native
// alert with a red button on the phone. Alert does nothing in a browser, so the
// web demo falls back to the browser's own confirm (and proceeds where there is none).
export function confirmDestructive(prompt: DestructivePrompt, onConfirm: () => void): void {
  if (Platform.OS === "web") {
    const ask: ((message: string) => boolean) | undefined = (globalThis as { confirm?: (message: string) => boolean })
      .confirm;
    if (!ask || ask(`${prompt.title}\n\n${prompt.message}`)) onConfirm();
    return;
  }
  Alert.alert(prompt.title, prompt.message, [
    { text: "Cancel", style: "cancel" },
    { text: prompt.confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
