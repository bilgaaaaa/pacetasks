import { parseBrainDumpWithRules } from "../rulesParser";

// Time windows: "after", "before" and "between" in English and Italian become a window, not a fixed time.
function first(text: string) {
  const [candidate] = parseBrainDumpWithRules(text).candidates;
  return { title: candidate.title, dueTime: candidate.dueTime, timeWindow: candidate.timeWindow };
}

describe("rules parser time windows", () => {
  it.each([
    ["stasera dopo le 8 aperitivo", "Aperitivo", { start: "20:00", end: null }],
    ["after 8 tonight walk the dog", "Walk the dog", { start: "20:00", end: null }],
    ["finish the report before 6pm", "Finish the report", { start: null, end: "18:00" }],
    ["entro le 18 consegnare il pacco", "Consegnare il pacco", { start: null, end: "18:00" }],
    ["call mom between 7 and 9 pm", "Call mom", { start: "19:00", end: "21:00" }],
    ["aperitivo tra le 19 e le 21", "Aperitivo", { start: "19:00", end: "21:00" }],
    ["dalle 19 alle 21 palestra", "Palestra", { start: "19:00", end: "21:00" }],
  ])("%s", (text, title, timeWindow) => {
    expect(first(text)).toEqual({ title, dueTime: null, timeWindow });
  });

  it("keeps a single time as a fixed start", () => {
    expect(first("dentist at 15:30 tomorrow")).toEqual({ title: "Dentist", dueTime: "15:30", timeWindow: null });
  });
});
