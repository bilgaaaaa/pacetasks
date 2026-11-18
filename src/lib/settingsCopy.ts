import { msg } from "../i18n";
// Wording for the "While you work" switches in Settings. Each title is also the
// switch's accessibility label, so what is shown and what VoiceOver reads never drift apart.

// Stored as timer_chime_enabled: the alert's sound and the buzz when a timer ends, also with the phone locked.
export const TIMER_SOUND_TITLE = msg("Timer sound");
export const TIMER_SOUND_SUBTITLE = msg("A chime and a gentle buzz when a Focus session or range timer ends");

// Stored as haptics_enabled.
export const COMPLETION_TAP_TITLE = msg("Completion tap");
export const COMPLETION_TAP_SUBTITLE = msg("A light tap you can feel when you complete a task");

export const BRAIN_DUMP_AUTO_CREATE_TITLE = msg("Add clear brain dumps directly");
