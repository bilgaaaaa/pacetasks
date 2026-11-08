// Starts the PaceTasks demo inside the hero phone on wide screens. On a phone the
// link opens the demo full screen instead, where the app has the room it needs.
(function () {
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
    frame.title = "PaceTasks demo";
    phone.querySelector(".phone-screen").replaceChildren(frame);
    // The DeskFocus widget steps aside (see site.css) so the whole phone screen can be used.
    stage.dataset.demoLive = "true";

    // Once the demo runs here, the same button opens it full screen.
    launch.textContent = "Open the demo full screen";
    frame.focus();
    console.info("[site] demo started in the hero phone");
  });
})();
