// Scroll-spy of the page index (spec 7.11). PageLayout imports it once with an Astro
// <script>, only on pages that render a Toc (spec 7.3). It works by delegation over
// [data-ac-toc], so static HTML and markup painted by an island are treated the same.
//
// The current section is the last one whose top has reached the anchor line; at the end
// of the document it is the last section, and above the first one it is still the first.
// The script only moves `aria-current="location"`, which is what turns the entry
// `text-primary` in src/styles/components/toc.css.

/**
 * Where a section title lands after a jump from the index: the 64 px header
 * (`scroll-padding-top` on html) plus the 16 px `scroll-margin-top` of Section
 * (spec 5.9). The spy measures against the same line, so the entry the reader
 * clicked is the entry that ends up marked.
 */
const ANCHOR = 80;

/**
 * Rect tops and scroll heights are fractional: a section sitting exactly on the
 * anchor line, and a page scrolled to its very end, both count as reached.
 */
const TOLERANCE = 1;

interface Entry {
  /** The index link that carries `aria-current`. */
  readonly link: HTMLAnchorElement;
  /** id of the Section it points at. */
  readonly id: string;
}

/** Every index link of the page, in document order, with the id it points at. */
function readEntries(): Entry[] {
  const entries: Entry[] = [];
  for (const root of document.querySelectorAll('[data-ac-toc]')) {
    for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      const id = (link.getAttribute('href') ?? '').slice(1);
      if (id) entries.push({ link, id });
    }
  }
  return entries;
}

/** Index of the entry the reader is on, or -1 when no entry can be resolved. */
function currentIndex(entries: Entry[]): number {
  const page = document.documentElement;
  const atEnd =
    page.scrollHeight > window.innerHeight &&
    window.innerHeight + window.scrollY >= page.scrollHeight - TOLERANCE;

  // At the end of the document the last section wins even if it never reached the
  // anchor line, which is the only way a short last section can be marked at all.
  if (atEnd) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (document.getElementById(entries[index].id)) return index;
    }
  }

  let found = -1;
  for (let index = 0; index < entries.length; index += 1) {
    const section = document.getElementById(entries[index].id);
    if (!section) continue;
    if (section.getBoundingClientRect().top - ANCHOR <= TOLERANCE) found = index;
  }

  // Above the first section the index still marks the first entry.
  return found >= 0 ? found : entries.length > 0 ? 0 : -1;
}

function spy(entries: Entry[]): void {
  let frame = 0;
  let marked = -1;

  const update = (): void => {
    frame = 0;
    const index = currentIndex(entries);
    if (index === marked) return;
    marked = index;
    entries.forEach((entry, position) => {
      if (position === index) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
    });
  };

  // Reads are grouped in one frame so a burst of scroll events measures the page once.
  const schedule = (): void => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  update();
  // Capture, so scrolling inside a nested scroller is seen too; passive, so the
  // listener never delays the scroll itself.
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule);
}

const entries = readEntries();
if (entries.length > 0) spy(entries);

// This module is loaded with a dynamic import, from the pages that render a rail
// index (spec 7.3): an .astro <script> is hoisted at compile time, so the only way to
// keep the module off a page with no index is to ask for it at run time. TypeScript
// only accepts `import()` on a module, and a file with no import and no export is a
// script (ts2306), so this line is what makes the lazy form legal.
export {};
