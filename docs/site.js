// Page-wide bits: the footer year, the Mac menu bar clock, and the PaceTasks demo inside the hero phone.
(function () {
  const LOG_PREFIX = "[site]";
  const log = (message) => console.info(`${LOG_PREFIX} ${message}`);

  const initYear = () => {
    const year = document.querySelector("[data-current-year]");
    if (year) year.textContent = String(new Date().getFullYear());
  };

  // The desktop mockup's menu bar shows the visitor's own date and time, like a real Mac.
  const initClock = () => {
    const clock = document.querySelector("[data-current-time]");
    if (!clock) return;
    const formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const render = () => {
      clock.textContent = formatter.format(new Date()).replace(",", "");
    };
    render();
    setInterval(render, 30_000);
  };

  // On wide screens the demo starts inside the hero phone; on a phone the link opens it full screen.
  const initDemo = () => {
    const wideScreen = window.matchMedia("(min-width: 960px)");
    const launch = document.querySelector("[data-demo-launch]");
    const stage = document.querySelector("[data-hero-stage]");
    const phone = document.querySelector("[data-demo-phone]");
    if (!launch || !stage || !phone) return;

    launch.addEventListener("click", (event) => {
      if (!wideScreen.matches || stage.dataset.demoLive) return;
      event.preventDefault();

      const frame = document.createElement("iframe");
      frame.src = launch.href;
      frame.title = "PaceTasks demo";
      phone.querySelector(".phone__screen").replaceChildren(frame);
      // The DeskFocus widget steps aside (see site.css) so the whole phone screen can be used.
      stage.dataset.demoLive = "true";
      stage.scrollIntoView({ behavior: "smooth", block: "center" });

      // Once the demo runs here, the same button opens it full screen.
      launch.textContent = "Open the demo full screen";
      frame.focus({ preventScroll: true });
      log("demo started in the hero phone");
    });
  };

  initYear();
  initClock();
  initDemo();
})();
