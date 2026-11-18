// DeskFocus widget preview: today's list, a focus timer on the chosen task and the apps hidden while
// it runs. The app switches further down the page share the same state as the widget's footer.
(function () {
  const LOG_PREFIX = "[site]";
  const RING_LENGTH = 2 * Math.PI * 44;
  const TICK_MS = 250;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Every text this script writes, in the page's language (<html lang>).
  const TEXTS = {
    en: {
      tasks: {
        "morning-run": "Morning run",
        "deep-work": "Deep work: launch plan",
        "design-review": "Design review",
        dentist: "Call the dentist",
        "train-tickets": "Book train tickets",
      },
      sources: { PaceTasks: "PaceTasks", Calendar: "Calendar", Reminders: "Reminders" },
      messages: "Messages",
      allDone: "Everything is done for today",
      start: "Start",
      pause: "Pause",
      startAgain: "Start again",
      minutes: (minutes) => `${minutes} min`,
      progress: (done, total) => `${done} of ${total} done`,
      doneLabel: (title) => `Done: ${title}`,
      focusLabel: (title, source) => `Focus on ${title}, from ${source}`,
      hiddenApps: (names) => `Hidden while you focus: ${names}`,
      noHiddenApps: "No apps hidden while you focus",
    },
    it: {
      tasks: {
        "morning-run": "Corsa del mattino",
        "deep-work": "Lavoro profondo: piano di lancio",
        "design-review": "Revisione del design",
        dentist: "Chiamare il dentista",
        "train-tickets": "Prenotare i biglietti del treno",
      },
      sources: { PaceTasks: "PaceTasks", Calendar: "Calendario", Reminders: "Promemoria" },
      messages: "Messaggi",
      allDone: "Per oggi è tutto fatto",
      start: "Inizia",
      pause: "Pausa",
      startAgain: "Ricomincia",
      minutes: (minutes) => `${minutes} min`,
      progress: (done, total) => `${done} di ${total} fatte`,
      doneLabel: (title) => `Fatta: ${title}`,
      focusLabel: (title, source) => `Focus su ${title}, da ${source}`,
      hiddenApps: (names) => `Nascoste mentre ti concentri: ${names}`,
      noHiddenApps: "Nessuna app nascosta mentre ti concentri",
    },
  };
  const language = document.documentElement.lang in TEXTS ? document.documentElement.lang : "en";
  const texts = TEXTS[language];

  // The sample day from the PaceTasks screenshots, with a calendar event and a reminder mixed in.
  // `source` is the key the styles use; its name on screen comes from the texts.
  const TASKS = [
    { id: "morning-run", source: "PaceTasks", minutes: 30 },
    { id: "deep-work", source: "PaceTasks", minutes: 25 },
    { id: "design-review", source: "Calendar", minutes: 30 },
    { id: "dentist", source: "PaceTasks", minutes: 5 },
    { id: "train-tickets", source: "Reminders", minutes: 10 },
  ].map((task) => ({ ...task, title: texts.tasks[task.id] }));

  const APPS = [
    { id: "mail", name: "Mail", hidden: true },
    { id: "messages", name: texts.messages, hidden: false },
    { id: "slack", name: "Slack", hidden: true },
    { id: "whatsapp", name: "WhatsApp", hidden: true },
  ];

  const state = {
    selectedTaskId: "deep-work",
    doneTaskIds: new Set(["morning-run"]),
    hiddenAppIds: new Set(APPS.filter((app) => app.hidden).map((app) => app.id)),
    remainingSeconds: 0,
    endsAt: 0,
    timerId: null,
  };

  const query = (name) => document.querySelector(`[${name}]`);
  const elements = {
    widget: query("data-widget"),
    progress: query("data-widget-progress"),
    taskList: query("data-widget-tasks"),
    focusTask: query("data-focus-task"),
    focusTime: query("data-focus-time"),
    focusRing: query("data-focus-ring"),
    focusToggle: query("data-focus-toggle"),
    focusDone: query("data-focus-done"),
    hiddenApps: query("data-hidden-apps"),
    appSwitches: query("data-app-switches"),
  };
  const taskRows = new Map();
  const listFormat = new Intl.ListFormat(language, { style: "long", type: "conjunction" });

  const log = (message) => console.info(`${LOG_PREFIX} ${message}`);

  // ---------- Timer ----------

  const getTask = (taskId) => TASKS.find((task) => task.id === taskId) ?? null;
  const getSelectedTask = () => getTask(state.selectedTaskId);
  const isTimerRunning = () => state.timerId !== null;

  const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const renderTimer = () => {
    const task = getSelectedTask();
    const totalSeconds = task ? task.minutes * 60 : 0;
    const progress = totalSeconds ? state.remainingSeconds / totalSeconds : 0;

    elements.focusTask.textContent = task ? task.title : texts.allDone;
    elements.focusTime.textContent = formatTime(state.remainingSeconds);
    elements.focusRing.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
    elements.focusToggle.disabled = !task;
    elements.focusDone.disabled = !task;

    if (isTimerRunning()) elements.focusToggle.textContent = texts.pause;
    else if (task && state.remainingSeconds === 0) elements.focusToggle.textContent = texts.startAgain;
    else elements.focusToggle.textContent = texts.start;
  };

  const stopTimer = () => {
    if (!isTimerRunning()) return;
    clearInterval(state.timerId);
    state.timerId = null;
  };

  // Counts down from a fixed end time, so a throttled background tab stays accurate.
  const tickTimer = () => {
    const remaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
    if (remaining === state.remainingSeconds) return;
    state.remainingSeconds = remaining;
    if (remaining === 0) {
      stopTimer();
      log(`time is up for "${getSelectedTask()?.title}"`);
    }
    renderTimer();
  };

  const toggleTimer = () => {
    const task = getSelectedTask();
    if (!task) return;

    if (isTimerRunning()) {
      stopTimer();
      log(`focus paused on "${task.title}"`);
    } else {
      // Starting after the time is up begins a fresh session.
      if (state.remainingSeconds === 0) state.remainingSeconds = task.minutes * 60;
      state.endsAt = Date.now() + state.remainingSeconds * 1000;
      state.timerId = setInterval(tickTimer, TICK_MS);
      log(`focus started on "${task.title}"`);
    }
    renderTimer();
  };

  // ---------- Tasks ----------

  // Every task carries its own timer, so choosing one sets the clock to its minutes.
  const setSelectedTask = (taskId) => {
    stopTimer();
    state.selectedTaskId = taskId;
    state.remainingSeconds = (getTask(taskId)?.minutes ?? 0) * 60;
  };

  // The next open task after the given one, wrapping around to the top of the list.
  const findNextOpenTaskId = (afterTaskId) => {
    const start = TASKS.findIndex((task) => task.id === afterTaskId);
    const ordered = [...TASKS.slice(start + 1), ...TASKS.slice(0, start + 1)];
    return ordered.find((task) => !state.doneTaskIds.has(task.id))?.id ?? null;
  };

  const renderTasks = () => {
    taskRows.forEach(({ row, check, select }, taskId) => {
      const isDone = state.doneTaskIds.has(taskId);
      const isSelected = taskId === state.selectedTaskId;
      row.classList.toggle("task--done", isDone);
      check.setAttribute("aria-pressed", String(isDone));
      select.setAttribute("aria-pressed", String(isSelected));
      select.disabled = isDone;
    });
    elements.progress.textContent = texts.progress(state.doneTaskIds.size, TASKS.length);
  };

  const render = () => {
    renderTasks();
    renderTimer();
  };

  const selectTask = (taskId) => {
    if (taskId === state.selectedTaskId || state.doneTaskIds.has(taskId)) return;
    setSelectedTask(taskId);
    log(`selected "${getTask(taskId).title}"`);
    render();
  };

  const toggleTaskDone = (taskId) => {
    const task = getTask(taskId);
    if (state.doneTaskIds.has(taskId)) {
      state.doneTaskIds.delete(taskId);
      if (!state.selectedTaskId) setSelectedTask(taskId);
      log(`marked "${task.title}" not done`);
    } else {
      state.doneTaskIds.add(taskId);
      if (taskId === state.selectedTaskId) setSelectedTask(findNextOpenTaskId(taskId));
      log(`marked "${task.title}" done`);
    }
    render();
  };

  const completeSelectedTask = () => {
    if (state.selectedTaskId) toggleTaskDone(state.selectedTaskId);
  };

  const createCheckIcon = () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 22 22");
    svg.setAttribute("aria-hidden", "true");

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "task__check-circle");
    circle.setAttribute("cx", "11");
    circle.setAttribute("cy", "11");
    circle.setAttribute("r", "10");

    const mark = document.createElementNS(SVG_NS, "path");
    mark.setAttribute("class", "task__check-mark");
    mark.setAttribute("d", "m6.5 11.2 3 3 6-6.4");

    svg.append(circle, mark);
    return svg;
  };

  const createSpan = (className, text) => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  };

  const createTaskRow = (task) => {
    const row = document.createElement("li");
    row.className = "task";

    const check = document.createElement("button");
    check.type = "button";
    check.className = "task__check";
    check.setAttribute("aria-label", texts.doneLabel(task.title));
    check.append(createCheckIcon());
    check.addEventListener("click", () => toggleTaskDone(task.id));

    const select = document.createElement("button");
    select.type = "button";
    select.className = "task__select";
    select.setAttribute("aria-label", texts.focusLabel(task.title, texts.sources[task.source]));
    select.addEventListener("click", () => selectTask(task.id));

    const text = createSpan("task__text", "");
    const source = createSpan("task__source source-dot", texts.sources[task.source]);
    source.dataset.source = task.source;
    text.append(createSpan("task__title", task.title), source);
    select.append(text, createSpan("task__minutes", texts.minutes(task.minutes)));

    row.append(check, select);
    return { row, check, select };
  };

  // ---------- Apps hidden during focus ----------

  const renderHiddenApps = () => {
    if (!elements.hiddenApps) return;
    const names = APPS.filter((app) => state.hiddenAppIds.has(app.id)).map((app) => app.name);
    elements.hiddenApps.textContent = names.length
      ? texts.hiddenApps(listFormat.format(names))
      : texts.noHiddenApps;
  };

  const setAppHidden = (app, isHidden) => {
    if (isHidden) state.hiddenAppIds.add(app.id);
    else state.hiddenAppIds.delete(app.id);
    log(`${app.name} ${isHidden ? "hidden" : "shown"} during focus`);
    renderHiddenApps();
  };

  const createAppToggle = (app) => {
    const label = document.createElement("label");
    label.className = "app-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "app-toggle__input";
    input.setAttribute("role", "switch");
    input.checked = state.hiddenAppIds.has(app.id);
    input.addEventListener("change", () => setAppHidden(app, input.checked));

    label.append(createSpan("app-toggle__name", app.name), input);
    return label;
  };

  // ---------- Init ----------

  if (elements.widget) {
    TASKS.forEach((task) => taskRows.set(task.id, createTaskRow(task)));
    elements.taskList.replaceChildren(...[...taskRows.values()].map(({ row }) => row));
    elements.focusRing.style.strokeDasharray = String(RING_LENGTH);
    elements.focusToggle.addEventListener("click", toggleTimer);
    elements.focusDone.addEventListener("click", completeSelectedTask);
    setSelectedTask(state.selectedTaskId);
    render();
    log("DeskFocus widget preview ready");
  }
  if (elements.appSwitches) elements.appSwitches.replaceChildren(...APPS.map(createAppToggle));
  renderHiddenApps();
})();
