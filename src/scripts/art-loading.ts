// Loading state of remote art (spec 7.4.2, 7.4.4). PageLayout ships it as a plain
// module script on every page, and it works with no React: the illustrations of a
// card, of a tooltip head or of a Pokémon sheet are plain `<img>` elements in the
// prerendered HTML, and the art itself comes from a remote host
// (src/lib/content/pokemon-media.ts), so it is the one image of the site that can
// still be on its way when the page is already painted.
//
// The script only writes `data-state` on the image. Everything visible is CSS:
// src/styles/components/sprite-stage.css hides the image while it loads, borrows
// the pulse of the `loading` box for the box around it, fades the image in over
// 300 ms when it arrives, and leaves the missing mark in the box when it never
// does — with no fallback initial (8.2).
//
// Pixel sprites are local and are not watched: only illustrations, which are the
// images `Sprite` marks with `ac-sprite--smooth` (7.4.2).

/** Illustrations: Pokémon art (140 px of origin) and element icons (100 px). */
const ART = 'img.ac-sprite--smooth';

/** `loading` until the image arrives, then `ready`; `error` when it never does. */
type ArtState = 'loading' | 'ready' | 'error';

function artImage(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof HTMLImageElement)) return null;
  return target.classList.contains('ac-sprite--smooth') ? target : null;
}

function mark(image: HTMLImageElement, state: ArtState): void {
  image.dataset.state = state;
}

/**
 * State an image starts the page with. An image the browser already finished
 * never fires `load` again, so it is settled here instead of waiting for an event
 * that will not come: a healthy one carries no state at all, because it was never
 * loading and so has nothing to fade in from.
 *
 * An image the listeners already resolved is left alone, which is what keeps the
 * second pass from cutting a fade that has just started.
 */
function settle(image: HTMLImageElement): void {
  if (image.dataset.state) return;
  if (!image.complete) {
    mark(image, 'loading');
    return;
  }
  if (image.naturalWidth === 0) mark(image, 'error');
}

// `load` and `error` do not bubble, so both listeners capture on the document.
// They are attached before the first pass over the page: an image that arrives
// between the two would otherwise be left pulsing for good. They also cover the
// art an island paints after hydration, which enters with the same fade.
document.addEventListener(
  'load',
  (event) => {
    const image = artImage(event.target);
    if (image) mark(image, 'ready');
  },
  true,
);

document.addEventListener(
  'error',
  (event) => {
    const image = artImage(event.target);
    if (image) mark(image, 'error');
  },
  true,
);

// The fade is the entry of an image that arrived, and it plays once. A CSS animation
// starts again every time its element leaves `display: none`, and the art of a game
// tooltip head does that on every opening of its popover: left `ready`, the Pokémon
// would fade in over 300 ms each time the panel opens, on top of the 150 ms entry of
// the panel. Once the fade has run — or the panel closed in the middle of it — the
// image goes back to carrying no state, like one that was already there when the page
// loaded.
function settleFade(event: AnimationEvent): void {
  const image = artImage(event.target);
  if (image && image.dataset.state === 'ready' && event.animationName === 'ac-fade') {
    delete image.dataset.state;
  }
}

document.addEventListener('animationend', settleFade, true);
document.addEventListener('animationcancel', settleFade, true);

function settleAll(): void {
  for (const image of document.querySelectorAll<HTMLImageElement>(ART)) settle(image);
}

settleAll();
// The module is deferred, so the whole page is parsed by now on a page that was
// served whole; a streamed one can still be growing, and the second pass settles
// what the first one could not see yet.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', settleAll, { once: true });
}
