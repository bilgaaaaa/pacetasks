import { answerNext, answerToday } from "../siriAnswers";
import type { SiriMoment } from "../siriAnswers";
import {
  addedSpeech,
  formatDuration,
  joinTitles,
  proRequiredSpeech,
  siriLanguage,
  todaySpeech,
} from "../siriSpeech";
import { makeTask } from "../../testing/makeTask";
import { toLocalTimeOfDay } from "../../dates";

const TODAY = "2026-09-28";

function moment(overrides: Partial<SiriMoment> = {}): SiriMoment {
  return { todayKey: TODAY, timeOfDay: "18:00", currentTiming: "after_work", language: "en", ...overrides };
}

describe("siriLanguage", () => {
  it("answers in Italian or Turkish when Siri speaks them, English otherwise", () => {
    expect(siriLanguage("it-IT")).toBe("it");
    expect(siriLanguage("tr")).toBe("tr");
    expect(siriLanguage("en-GB")).toBe("en");
    expect(siriLanguage("de-DE")).toBe("en");
    expect(siriLanguage(null)).toBe("en");
  });
});

describe("speech helpers", () => {
  it("joins titles naturally in each language", () => {
    expect(joinTitles("en", ["A"])).toBe("A");
    expect(joinTitles("en", ["A", "B", "C"])).toBe("A, B and C");
    expect(joinTitles("it", ["A", "B"])).toBe("A e B");
    expect(joinTitles("tr", ["A", "B"])).toBe("A ve B");
  });

  it("says durations the way people do", () => {
    expect(formatDuration("en", 1)).toBe("1 minute");
    expect(formatDuration("en", 60)).toBe("1 hour");
    expect(formatDuration("en", 140)).toBe("2 hours 20 minutes");
    expect(formatDuration("it", 80)).toBe("1 ora e 20 minuti");
    expect(formatDuration("tr", 80)).toBe("1 saat 20 dakika");
  });

  it("confirms what was added and flags anything it missed", () => {
    expect(addedSpeech("en", ["Call the vet"], 0)).toBe("Added Call the vet.");
    expect(addedSpeech("it", ["Comprare il pane", "Pagare la luce"], 1)).toBe(
      "Ho aggiunto 2 attività: Comprare il pane e Pagare la luce. Una parte non l'ho capita: dai un'occhiata nell'app."
    );
    expect(addedSpeech("tr", [], 0)).toBe("Söylediklerinde bir görev bulamadım. Biraz farklı söylemeyi dene.");
  });

  it("counts today's tasks with the right plural", () => {
    expect(todaySpeech("en", 0, 0, [])).toBe("Nothing left for today.");
    expect(todaySpeech("en", 1, 10, ["Pay rent"])).toBe("You have 1 task left today: Pay rent, about 10 minutes.");
    expect(todaySpeech("tr", 4, 80, ["A", "B", "C"])).toBe(
      "Bugün 4 görevin kaldı, toplam yaklaşık 1 saat 20 dakika. İlk sırada: A, B ve C."
    );
  });

  it("invites free users to the trial", () => {
    expect(proRequiredSpeech("it")).toContain("PaceTasks Pro");
  });
});

describe("answerNext", () => {
  it("names the task Decide for me would pick", () => {
    const tasks = [
      makeTask({ id: "later", title: "Sort photos", priority: "low", estimated_minutes: 30 }),
      makeTask({ id: "due", title: "Pay rent", due_date: TODAY, due_kind: "on", estimated_minutes: 5 }),
    ];
    expect(answerNext(tasks, moment())).toEqual({ speech: "Next up: Pay rent. It takes about 5 minutes.", taskIds: ["due"] });
  });

  it("falls back to the next fixed-time task when nothing else is left", () => {
    const tasks = [
      makeTask({ id: "gym", title: "Gym", scheduled_time: "19:30" }),
      makeTask({ id: "call", title: "Call mum", scheduled_time: "08:00" }),
    ];
    expect(answerNext(tasks, moment()).taskIds).toEqual(["gym"]);
    expect(answerNext(tasks, moment({ timeOfDay: "21:00" })).speech).toBe("Next is Call mum at 08:00.");
  });

  it("celebrates a cleared day and ignores tasks for other days", () => {
    const tasks = [makeTask({ status: "done" }), makeTask({ due_date: "2026-09-30", due_kind: "on" })];
    expect(answerNext(tasks, moment())).toEqual({ speech: "You're all clear for today. Nice work!", taskIds: [] });
  });
});

describe("answerToday", () => {
  it("counts only today's pending tasks and names the first three", () => {
    const tasks = [
      makeTask({ id: "1", title: "A", estimated_minutes: 10 }),
      makeTask({ id: "2", title: "B", estimated_minutes: 20 }),
      makeTask({ id: "3", title: "C", estimated_minutes: 30 }),
      makeTask({ id: "4", title: "D", estimated_minutes: 20 }),
      makeTask({ id: "5", title: "Done", status: "done" }),
      makeTask({ id: "6", title: "Someday", status: "someday" }),
    ];
    expect(answerToday(tasks, moment())).toEqual({
      speech: "You have 4 tasks left today, about 1 hour 20 minutes in all. First up: A, B and C.",
      taskIds: ["1", "2", "3", "4"],
    });
  });
});

describe("toLocalTimeOfDay", () => {
  it("reads the wall clock in the phone's time zone", () => {
    expect(toLocalTimeOfDay(new Date("2026-09-28T22:05:00Z"), "Europe/Rome")).toBe("00:05");
    expect(toLocalTimeOfDay(new Date("2026-09-28T07:05:00Z"), "Europe/Istanbul")).toBe("10:05");
  });
});
