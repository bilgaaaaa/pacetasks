// Starts the PaceTasks demo inside the hero phone on wide screens. On a phone the
// link opens the demo full screen instead, where the app has the room it needs.
(function () {
  // The page's language decides the texts this script writes.
  const TEXTS = {
    en: { demoTitle: "PaceTasks demo", openFullScreen: "Open the demo full screen" },
    it: { demoTitle: "Demo di PaceTasks", openFullScreen: "Apri la demo a schermo intero" },
  };
  const texts = TEXTS[document.documentElement.lang] || TEXTS.en;
  const wideScreen = window.matchMedia("(min-width: 900px)");
  const launch = document.querySelector("[data-demo-launch]");
  const stage = document.querySelector("[data-hero-stage]");
  const phone = document.querySelector("[data-demo-phone]");
  if (!launch || !stage || !phone) return;

  launch.addEventListener("click", (event) => {
    if (!wideScreen.matches || stage.dataset.demoLive) return;
    event.preventDefault();

    const frame = document.createElement("iframe");
    frame.src = launch.href;
    frame.title = texts.demoTitle;
    phone.querySelector(".phone-screen").replaceChildren(frame);
    // The DeskFocus widget steps aside (see site.css) so the whole phone screen can be used.
    stage.dataset.demoLive = "true";

    // Once the demo runs here, the same button opens it full screen.
    launch.textContent = texts.openFullScreen;
    frame.focus();
    console.info("[site] demo started in the hero phone");
  });
})();
