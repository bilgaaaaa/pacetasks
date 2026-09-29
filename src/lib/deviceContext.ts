// The phone's own context sent with AI requests: "today" is always the device's
// calendar in its time zone, and the locale is only a hint (not the input language).

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getDeviceLocale(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().locale || null;
}
