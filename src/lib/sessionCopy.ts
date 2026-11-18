import { msg } from "../i18n";
// UI copy for the screen shown when the app could not start a session. Wording
// lives here so it can be localized later without touching the logic.

export const SESSION_ERROR_TITLE = msg("PaceTasks couldn't connect");
export const SESSION_ERROR_HINT =
  msg("Check your internet connection, then try again. If it keeps happening, this build is missing its server settings.");
export const SESSION_RETRY_LABEL = msg("Try again");
