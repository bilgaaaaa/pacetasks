import { focusTimeUpCopy, rangeTimeUpCopy } from "../timerAlertCopy";

describe("timer alert copy", () => {
  it("says the same as the widget's own Focus alert", () => {
    expect(focusTimeUpCopy("Write the report")).toEqual({
      title: "Focus time is up",
      body: "Write the report — mark it done or start another round.",
    });
  });

  it("names the task and its usual longest time for the range timer", () => {
    expect(rangeTimeUpCopy("Tidy the kitchen", 20)).toEqual({
      title: "Time's up",
      body: "Tidy the kitchen reached its usual 20 min. Done?",
    });
  });
});
