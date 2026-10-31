// "Fit my time" on the landing page: the app's rules from @domain/doNow, simplified
// to a fixed sample day, so visitors can try the idea before installing.

const QUICK_WIN_MINUTES = 5; // the app's default quick-win limit
const ENERGY_LEVELS = ["low", "medium", "high"];
// A task with unknown energy is ranked as needing a normal amount, and never hidden.
const ASSUMED_TASK_ENERGY = "medium";
// Overdue and due-today tasks lead, then deadlines; undated tasks come last.
const DUE_RANK = { overdue: 0, today: 1, deadline: 2 };
const NO_DUE_RANK = 3;
const DUE_LABELS = { overdue: "Overdue", today: "Today", deadline: "by Fri" };

// Category names and the Sunny theme's dark-mode colours, since the card is always dark.
const CATEGORIES = {
  work: { label: "Work", color: "#a9bdeb" },
  personal: { label: "Personal", color: "#cdb2e6" },
  shopping: { label: "Shopping", color: "#f6c08e" },
  home: { label: "Home", color: "#6cc7ba" },
  health: { label: "Health", color: "#f3a0b9" },
};
const SEGMENT_COLORS = ["--daffodil", "--pool-time", "--peaches", "--cotton-candy", "--blue-skies", "--baby-lavender"];

// The web demo's seeded tasks that can be started at any moment today.
const SAMPLE_TASKS = [
  { title: "Send the tax documents", minutes: 20, energy: null, category: "work", due: "overdue" },
  { title: "Call the bank", minutes: 10, energy: "low", category: "personal", due: "overdue" },
  { title: "Call the dentist", minutes: 5, energy: "low", category: "health", due: "today" },
  { title: "Renew bike insurance", minutes: 15, energy: null, category: "personal", due: "deadline" },
  { title: "Fix the squeaky door", minutes: 15, energy: null, category: "home", due: null },
  { title: "Reply to Marco", minutes: 10, energy: "low", category: "work", due: null },
  { title: "Pay the phone bill", minutes: 3, energy: "low", category: "home", due: null },
  { title: "Groceries", minutes: 25, energy: "medium", category: "shopping", due: null },
  { title: "Plan the weekend trip", minutes: 30, energy: "medium", category: "personal", due: null },
  { title: "Morning run", minutes: 30, energy: "high", category: "health", due: null },
  { title: "Sort the photo backup", minutes: 40, energy: null, category: "personal", due: null },
];

function energyRank(level) {
  return ENERGY_LEVELS.indexOf(level);
}

// A task fits when it takes no longer than the time and no more energy than the user has.
function fitsNow(task, availableMinutes, energy) {
  return task.minutes <= availableMinutes && (task.energy === null || energyRank(task.energy) <= energyRank(energy));
}

// Sort keys, lower first: due tasks, then the closest energy match, then the longest task.
function rankKeys(task, energy) {
  return [
    task.due ? DUE_RANK[task.due] : NO_DUE_RANK,
    Math.abs(energyRank(energy) - energyRank(task.energy ?? ASSUMED_TASK_ENERGY)),
    -task.minutes,
  ];
}

function compareKeys(a, b) {
  const index = a.findIndex((key, i) => key !== b[i]);
  return index === -1 ? 0 : a[index] - b[index];
}

// Like selectDoNowTasks: ranks what fits, then fills the time back to back in that order.
function selectPlan(availableMinutes, energy) {
  const ranked = SAMPLE_TASKS.filter((task) => fitsNow(task, availableMinutes, energy))
    .map((task) => ({ task, keys: rankKeys(task, energy) }))
    .sort((a, b) => compareKeys(a.keys, b.keys))
    .map(({ task }) => task);

  const plan = [];
  const alternatives = [];
  let planMinutes = 0;
  for (const task of ranked) {
    if (planMinutes + task.minutes <= availableMinutes) {
      plan.push(task);
      planMinutes += task.minutes;
    } else {
      alternatives.push(task);
    }
  }
  return { plan, planMinutes, alternatives };
}

function minutesLabel(minutes) {
  return minutes === 60 ? "1 hour" : `${minutes} min`;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// One row as the app draws it: an empty check circle, the title, its category, and the minutes pill.
function createRow(task, index) {
  const row = createElement("li", "fit-row");
  row.style.setProperty("--i", String(index));

  const text = createElement("span");
  text.append(createElement("span", "fit-row-title", task.title));
  const category = CATEGORIES[task.category];
  const meta = createElement("span", "fit-row-meta");
  if (task.due) meta.append(createElement("span", "fit-row-due", DUE_LABELS[task.due]));
  const categoryTag = createElement("span", "fit-row-category", category.label);
  categoryTag.style.setProperty("--category", category.color);
  meta.append(categoryTag);
  text.append(meta);

  const quickWin = task.minutes <= QUICK_WIN_MINUTES;
  const pill = createElement("span", quickWin ? "fit-minutes is-quick-win" : "fit-minutes", minutesLabel(task.minutes));
  row.append(text, pill);
  return row;
}

// The lane starts empty and fills to each task's share of the time, so a new choice visibly refills it.
function renderLane(lane, plan, availableMinutes) {
  const segments = plan.map((task, index) => {
    const segment = createElement("span", "fit-segment");
    segment.style.setProperty("--segment", `var(${SEGMENT_COLORS[index % SEGMENT_COLORS.length]})`);
    return segment;
  });
  lane.replaceChildren(...segments);
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      segments.forEach((segment, index) => {
        segment.style.flexBasis = `${(plan[index].minutes / availableMinutes) * 100}%`;
      })
    )
  );
}

function alternativesText(count) {
  if (count === 0) return "";
  return count === 1 ? "Or instead: 1 more task fits on its own." : `Or instead: ${count} more tasks fit on their own.`;
}

function setUpFitMyTime() {
  const card = document.getElementById("fit-my-time");
  const lane = document.getElementById("fit-lane");
  const total = document.getElementById("fit-total");
  const planList = document.getElementById("fit-plan");
  const more = document.getElementById("fit-more");
  if (!card || !lane || !total || !planList || !more) {
    console.warn("[home] Fit my time card is missing from the page; the demo stays off");
    return;
  }

  const render = () => {
    const availableMinutes = Number(card.querySelector('input[name="minutes"]:checked').value);
    const energy = card.querySelector('input[name="energy"]:checked').value;
    const { plan, planMinutes, alternatives } = selectPlan(availableMinutes, energy);

    renderLane(lane, plan, availableMinutes);
    planList.replaceChildren(...plan.map(createRow));
    total.textContent = `${plan.length} ${plan.length === 1 ? "task" : "tasks"}, ${planMinutes} of ${availableMinutes} min`;
    more.textContent = alternativesText(alternatives.length);
  };

  card.addEventListener("change", render);
  render();
}

setUpFitMyTime();
