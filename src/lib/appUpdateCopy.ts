// Wording for the "new version" prompt shown when the app opens.

export const UPDATE_TITLE = "A new version is here";
export const UPDATE_NOW_LABEL = "Update now";
export const UPDATE_LATER_LABEL = "Later";
export const UPDATE_NOTES_LABEL = "WHAT'S NEW";

// "Version 1.1.0 is on the App Store. You have 1.0.0."
export function updateMessage(storeVersion: string, installedVersion: string): string {
  return `Version ${storeVersion} is on the App Store. You have ${installedVersion}.`;
}

// Release notes can be long; the prompt shows the start and the store shows the rest.
const NOTES_MAX_LENGTH = 280;

export function shortReleaseNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.length <= NOTES_MAX_LENGTH ? notes : `${notes.slice(0, NOTES_MAX_LENGTH).trimEnd()}…`;
}
