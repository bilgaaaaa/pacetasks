// Scroll-driven effects from the DeskFocus site: section reveals, word-by-word paragraph lighting,
// the horizontal statement band, the feature marquee and the active section in the bottom bar.
(function () {
  const LOG_PREFIX = "[site]";
  const log = (message) => console.info(`${LOG_PREFIX} ${message}`);

  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // ---------- Reveal on scroll ----------

  const initReveal = () => {
    const targets = document.querySelectorAll("[data-reveal]");
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15 },
    );
    targets.forEach((target) => observer.observe(target));
  };

  // ---------- Word-by-word paragraph lighting ----------

  const splitIntoWords = (element) => {
    const spans = element.textContent.trim().split(/\s+/).map((word) => {
      const span = document.createElement("span");
      span.className = "reveal-word";
      span.textContent = word;
      return span;
    });
    // Spaces stay as text nodes so the paragraph still reads naturally to screen readers.
    element.replaceChildren(...spans.flatMap((span, index) => (index ? [document.createTextNode(" "), span] : [span])));
    return spans;
  };

  const createRevealTextUpdater = () => {
    const paragraphs = [...document.querySelectorAll("[data-reveal-text]")].map((element) => ({
      element,
      words: splitIntoWords(element),
    }));

    if (prefersReducedMotion()) {
      paragraphs.forEach(({ words }) => words.forEach((word) => word.classList.add("is-lit")));
      return () => {};
    }

    return () => {
      const viewportHeight = window.innerHeight;
      paragraphs.forEach(({ element, words }) => {
        const rect = element.getBoundingClientRect();
        // Lighting starts when the paragraph enters the lower 85% of the screen and ends near the middle.
        const start = viewportHeight * 0.85;
        const end = viewportHeight * 0.4;
        const progress = clamp((start - rect.top) / (start - end + rect.height * 0.5), 0, 1);
        const litCount = Math.round(progress * words.length);
        words.forEach((word, index) => word.classList.toggle("is-lit", index < litCount));
      });
    };
  };

  // ---------- Horizontal statement band ----------

  const createStatementUpdater = () => {
    const section = document.querySelector("[data-statement]");
    const track = document.querySelector("[data-statement-track]");
    if (!section || !track || prefersReducedMotion()) return () => {};

    return () => {
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress = clamp(-rect.top / scrollable, 0, 1);
      // Ends with the last word resting near the right edge rather than scrolling fully out.
      const distance = track.scrollWidth - window.innerWidth * 0.95;
      track.style.transform = `translate3d(${-progress * distance}px, 0, 0)`;
    };
  };

  // ---------- Marquee ----------

  // The page lists the items once; a second row starts halfway through so the two rows don't mirror.
  const initMarquee = () => {
    const marquee = document.querySelector("[data-marquee]");
    const primary = marquee?.querySelector(".marquee__track");
    if (!marquee || !primary) return;

    const items = [...primary.children];
    const half = Math.ceil(items.length / 2);
    const secondary = document.createElement("ul");
    secondary.className = "marquee__track marquee__track--reverse";
    secondary.setAttribute("aria-hidden", "true");
    secondary.append(...[...items.slice(half), ...items.slice(0, half)].map((item) => item.cloneNode(true)));
    marquee.append(secondary);

    if (prefersReducedMotion()) return;
    // A hidden second copy in each row makes the CSS loop seamless.
    [primary, secondary].forEach((track) => {
      const copies = [...track.children].map((item) => item.cloneNode(true));
      copies.forEach((copy) => copy.setAttribute("aria-hidden", "true"));
      track.append(...copies);
    });
  };

  // ---------- Active section in the bottom bar ----------

  const initSectionNav = () => {
    const links = new Map(
      [...document.querySelectorAll("[data-section-link]")].map((link) => [link.dataset.sectionLink, link]),
    );
    const sections = document.querySelectorAll("[data-section]");
    if (!links.size || !("IntersectionObserver" in window)) return;

    const setActive = (sectionName) => {
      links.forEach((link, name) => {
        if (name === sectionName) {
          link.setAttribute("aria-current", "true");
          // Keeps the active pill visible when the bar scrolls sideways on small screens.
          const list = link.closest("ul");
          list?.scrollTo({ left: link.offsetLeft - list.clientWidth / 2 + link.offsetWidth / 2, behavior: "smooth" });
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    // A thin band across the middle of the viewport decides which section is current.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.dataset.section);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
  };

  // ---------- Init ----------

  initReveal();
  initMarquee();
  initSectionNav();

  const updaters = [createRevealTextUpdater(), createStatementUpdater()];
  let frameRequested = false;

  // Scroll work is batched into one animation frame to keep scrolling smooth.
  const onScroll = () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      updaters.forEach((update) => update());
      frameRequested = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
  log("scroll effects ready");
})();
