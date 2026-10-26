// Starts the live demo inside the hero phone on wide screens. On a phone the
// link opens the demo full screen instead, where the app has the room it needs.
(function () {
  const wideScreen = window.matchMedia("(min-width: 900px)");
  const launch = document.querySelector("[data-demo-launch]");
  const phone = document.querySelector("[data-demo-phone]");
  if (!launch || !phone) return;

  launch.addEventListener("click", (event) => {
    if (!wideScreen.matches || phone.dataset.live) return;
    event.preventDefault();

    const frame = document.createElement("iframe");
    frame.src = launch.getAttribute("href");
    frame.title = "PaceTasks demo";
    phone.querySelector(".phone-screen").replaceChildren(frame);
    phone.dataset.live = "true";

    // Once the demo runs here, the same button opens it full screen.
    launch.textContent = "Open the demo full screen";
    frame.focus();
    console.info("[site] demo started in the hero phone");
  });
})();
