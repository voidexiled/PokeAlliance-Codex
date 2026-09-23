// §14.3 contract gate: the rules of §12.1 and §13.7 that only the rendered page can
// answer. No `.eyebrow` and no text between the breadcrumb and the `h1` (G1); a keycap
// only inside a `SearchTrigger`, which answers Ctrl + K and Meta + K (PZ-02); a chevron
// only inside a control that opens something (G8); no theme button while there is one
// theme (X2, PZ-01); on a phone every interactive target of 44 × 44 with the exceptions
// of §13.7 (S14); no visible text below 12 px (U-02); never two `role="search"` on one
// page. On the parity routes, every visible control does something and nothing that looks
// like a control is hidden from assistive technology (S11).
//
// The routes come from tests/e2e/routes.ts, so the gate grows with the migration.
//
// Contract with tests/e2e/routes.ts (track C of M2): `testRoutes` is the §14.4 list and
// every entry carries `path` (site relative, with leading and trailing slash) and
// `locale` ('es' | 'en').

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElementHandle, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { queryRoutes, testRoutes, type TestRoute } from './routes';
import { esRutaParidad } from '../../scripts/lib/rutas-migradas.mjs';

/** §13.7: `size-touch`, below 768 px or with a coarse pointer. */
const TOUCH_TARGET = 44;
const TOUCH_VIEWPORT = 768;

/** §13.7 / U-02: no visible text computes below this. */
const MIN_FONT_SIZE = 12;

const GLYPH_SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src/components/icons/Glyph.tsx',
);

/**
 * G8 reads a chevron by its shape as well as by its class. `Glyph` writes no name on its
 * svg — only `lucide` and the caller's class (Glyph.tsx explains why) — so a chevron the
 * caller gives a neutral class, the `__glyph` of the language trigger or a bare Glyph, has
 * nothing a class selector could see. The shapes are the `CHEVRON_*` of Glyph.tsx, read
 * from its source so they cannot drift from what the page draws; a change in how that file
 * declares them fails here instead of leaving G8 blind.
 */
function glyphChevrons(): string[] {
  const source = readFileSync(GLYPH_SOURCE, 'utf8');
  const shapes: string[] = [];
  for (const declaration of source.matchAll(/const CHEVRON_[A-Z_]+: Shape = \{([\s\S]*?)\};/g)) {
    for (const path of declaration[1].matchAll(/\bd: '([^']+)'/g)) shapes.push(path[1]);
  }
  if (shapes.length < 3) {
    throw new Error(
      `G8 reads the chevrons of ${GLYPH_SOURCE} and found ${shapes.length} of the three ` +
        '(down, up and right): the CHEVRON_* declarations changed shape.',
    );
  }
  return shapes;
}

const CHEVRONS = glyphChevrons();

/**
 * Chevron shapes that are not the chevron of G8, which is the sign that a control opens
 * something. The steppers of `NumberField` draw the down and up glyphs as «−» and «+»:
 * they change a value and are named «Disminuir …» and «Aumentar …» (DS:NumberField). The
 * separator between crumbs is a `role="presentation"` item of DS:Breadcrumb, not a
 * control.
 */
const NOT_A_CHEVRON = '.ac-number-field__step, .ac-breadcrumb__sep';

/**
 * §13.7: the only targets that answer WCAG 2.5.8 with 8 px of separation instead of a
 * 44 px box are links inside a paragraph and links of fact rows (`FactLine`, and the
 * `FactList` of a card). A link-shaped entity trigger without a page is a `<button>` that
 * looks and reads as the link beside it (7.5.7), so it counts as one.
 */
const LINK_LIKE = 'a[href], .ac-nested-entity__trigger--link';
const IN_TEXT = 'p, .ac-fact-line, .ac-fact-list';

type ContractReport = {
  eyebrows: string[];
  headingPreambles: string[];
  strayKeycaps: string[];
  strayChevrons: string[];
  themeButtons: string[];
  smallText: string[];
  smallTargets: string[];
  searchRegions: number;
};

async function readContract(page: Page, touch: boolean): Promise<ContractReport> {
  return page.evaluate(
    ({
      touchTarget,
      minFontSize,
      checkTargets,
      chevronShapes,
      notAChevron,
      linkLike,
      inTextScope,
    }): ContractReport => {
      const visible = (element: Element): boolean => {
        if (typeof element.checkVisibility === 'function') {
          return element.checkVisibility({
            contentVisibilityAuto: true,
            opacityProperty: true,
            visibilityProperty: true,
          });
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const label = (element: Element): string => {
        const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const id = element.id === '' ? '' : `#${element.id}`;
        const classes = (element.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
        const first = classes.length === 0 ? '' : `.${classes[0]}`;
        return `${element.localName}${id}${first}${text === '' ? '' : ` «${text}»`}`;
      };

      const name = (element: Element): string =>
        element.getAttribute('aria-label') ?? (element.textContent ?? '').trim();

      const report: ContractReport = {
        eyebrows: [],
        headingPreambles: [],
        strayKeycaps: [],
        strayChevrons: [],
        themeButtons: [],
        smallText: [],
        smallTargets: [],
        searchRegions: document.querySelectorAll('[role="search"], search').length,
      };

      for (const eyebrow of document.querySelectorAll('.eyebrow')) {
        report.eyebrows.push(label(eyebrow));
      }

      for (const heading of document.querySelectorAll('h1')) {
        const previous = heading.previousElementSibling;
        if (previous === null) continue;
        if (previous.closest('.ac-breadcrumb') !== null || previous.localName === 'nav') continue;
        if ((previous.textContent ?? '').trim() === '') continue;
        report.headingPreambles.push(label(previous));
      }

      for (const keycap of document.querySelectorAll('kbd')) {
        if (!visible(keycap)) continue;
        if (keycap.closest('[data-ac-search-open], .ac-search-trigger') !== null) continue;
        report.strayKeycaps.push(label(keycap));
      }

      // G8: what carries «chevron» in its class, and every svg whose one shape is a
      // chevron of Glyph.tsx.
      const isGlyphChevron = (svg: Element): boolean => {
        const shapes = Array.from(svg.children).filter(
          (child) => child.localName !== 'title' && child.localName !== 'desc',
        );
        return (
          shapes.length === 1 &&
          shapes[0].localName === 'path' &&
          chevronShapes.includes((shapes[0].getAttribute('d') ?? '').trim())
        );
      };
      const chevrons = new Set<Element>([
        ...document.querySelectorAll('[class*="chevron"]'),
        ...Array.from(document.querySelectorAll('svg')).filter(isGlyphChevron),
      ]);
      for (const chevron of chevrons) {
        if (!visible(chevron)) continue;
        if (chevron.closest(notAChevron) !== null) continue;
        if (chevron.closest('[aria-expanded], [popovertarget], summary') !== null) continue;
        // A glyph has no text of its own; its parent says where it is.
        const parent = chevron.parentElement;
        report.strayChevrons.push(
          parent === null ? label(chevron) : `${label(chevron)} in ${label(parent)}`,
        );
      }

      const themePattern = /tema (claro|oscuro)|(light|dark) theme/i;
      for (const control of document.querySelectorAll('button, [role="button"]')) {
        if (themePattern.test(name(control))) report.themeButtons.push(label(control));
      }

      for (const element of document.querySelectorAll('body *')) {
        const hasOwnText = Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
        );
        if (!hasOwnText || !visible(element)) continue;
        const size = Number.parseFloat(getComputedStyle(element).fontSize);
        if (size < minFontSize - 0.01) report.smallText.push(`${label(element)} · ${size}px`);
      }

      if (checkTargets) {
        type Edges = { left: number; top: number; right: number; bottom: number };

        const px = (value: string): number => Number.parseFloat(value);

        /** The padding box of an element that clips what overflows it, or null. */
        const clipOf = (element: Element): { x: Edges | null; y: Edges | null } => {
          const style = getComputedStyle(element);
          const paints = /\b(?:paint|strict|content)\b/.test(style.contain);
          const clipsX = paints || style.overflowX !== 'visible';
          const clipsY = paints || style.overflowY !== 'visible';
          if (!clipsX && !clipsY) return { x: null, y: null };
          const rect = element.getBoundingClientRect();
          const edges: Edges = {
            left: rect.left + px(style.borderLeftWidth),
            top: rect.top + px(style.borderTopWidth),
            right: rect.right - px(style.borderRightWidth),
            bottom: rect.bottom - px(style.borderBottomWidth),
          };
          return { x: clipsX ? edges : null, y: clipsY ? edges : null };
        };

        /**
         * The box a positioned pseudo-element of `element` is placed in (CSS 2 §10.1):
         * the nearest box from the element up that is positioned — or, for `fixed`, that
         * only a transform, a filter or containment makes one — and the window when there
         * is none. The reference makes the element itself that box for every hit area, but
         * a hit area stretched over a larger ancestor is measured the same way.
         */
        const containerOf = (element: Element, fixed: boolean): Element | null => {
          for (let node: Element | null = element; node !== null; node = node.parentElement) {
            if (node === document.documentElement) return null;
            const style = getComputedStyle(node);
            if (!fixed && style.position !== 'static') return node;
            if (style.transform !== 'none' || style.filter !== 'none') return node;
            if (/\b(?:layout|paint|strict|content)\b/.test(style.contain)) return node;
            if (style.containerType !== '' && style.containerType !== 'normal') return node;
          }
          return null;
        };

        /**
         * S14 measures the zone a finger can hit, not only the painted box: the design
         * system gives a 24 px chip, a 16 px amount link or a 32 px «+N» a transparent
         * `::before` or `::after` of 44 over its own box under `pointer: coarse`
         * (DS:Chip, DS:PlusN, DS:DiamondsAmount). A press on a pseudo-element is a press
         * on its element, so the zone is the element's box joined to every positioned
         * pseudo-element it has, each one cut by whatever clips it — a hit area that a
         * card's `overflow: hidden` crops is not there.
         */
        const zoneOf = (element: Element, box: DOMRect): Edges => {
          const zone: Edges = {
            left: box.left,
            top: box.top,
            right: box.right,
            bottom: box.bottom,
          };

          for (const which of ['::before', '::after']) {
            const style = getComputedStyle(element, which);
            if (style.content === 'none' || style.content === 'normal') continue;
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            if (style.pointerEvents === 'none') continue;
            if (style.position !== 'absolute' && style.position !== 'fixed') continue;
            const width = px(style.width);
            const height = px(style.height);
            const left = px(style.left);
            const top = px(style.top);
            if (![width, height, left, top].every(Number.isFinite)) continue;

            // `left` and `top` resolve against the padding box of the containing block.
            const container = containerOf(element, style.position === 'fixed');
            let originX = 0;
            let originY = 0;
            if (container !== null) {
              const rect = container.getBoundingClientRect();
              const own = getComputedStyle(container);
              originX = rect.left + px(own.borderLeftWidth);
              originY = rect.top + px(own.borderTopWidth);
            } else if (style.position === 'absolute') {
              originX = -window.scrollX;
              originY = -window.scrollY;
            }
            const shift =
              style.transform === 'none' ? { e: 0, f: 0 } : new DOMMatrixReadOnly(style.transform);
            const area: Edges = {
              left: originX + left + shift.e,
              top: originY + top + shift.f,
              right: originX + left + shift.e + width,
              bottom: originY + top + shift.f + height,
            };
            // What clips the hit area: its containing block and every box above it, since
            // a box between the element and that block does not clip what it places.
            for (let node = container; node !== null; node = node.parentElement) {
              if (node === document.documentElement) break;
              const clip = clipOf(node);
              if (clip.x !== null) {
                area.left = Math.max(area.left, clip.x.left);
                area.right = Math.min(area.right, clip.x.right);
              }
              if (clip.y !== null) {
                area.top = Math.max(area.top, clip.y.top);
                area.bottom = Math.min(area.bottom, clip.y.bottom);
              }
            }
            if (area.right <= area.left || area.bottom <= area.top) continue;
            zone.left = Math.min(zone.left, area.left);
            zone.top = Math.min(zone.top, area.top);
            zone.right = Math.max(zone.right, area.right);
            zone.bottom = Math.max(zone.bottom, area.bottom);
          }
          return zone;
        };

        const interactive = [
          ...document.querySelectorAll(
            'a[href], button, input:not([type="hidden"]), select, textarea, summary,' +
              ' [role="button"], [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(visible);
        const boxes = interactive.map((element) => element.getBoundingClientRect());

        // §13.7 and S14: the exception list is closed — «enlaces dentro de un párrafo y
        // enlaces de filas de hechos», and nothing else. Those answer WCAG 2.5.8 with
        // «8 px de separación» instead of a 44 px box, and the exemption is only granted
        // when that separation is really there, so a cramped run of text is still
        // reported. Any other target that wants a smaller box needs a §13.7 amendment,
        // not an entry here.
        const SEPARATION = 8;
        const gap = (a: DOMRect, b: DOMRect): number =>
          Math.hypot(
            Math.max(a.left - b.right, b.left - a.right, 0),
            Math.max(a.top - b.bottom, b.top - a.bottom, 0),
          );

        interactive.forEach((target, index) => {
          const rect = boxes[index];
          const zone = zoneOf(target, rect);
          const zoneWidth = zone.right - zone.left;
          const zoneHeight = zone.bottom - zone.top;
          if (zoneWidth >= touchTarget - 0.5 && zoneHeight >= touchTarget - 0.5) return;

          const size = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
          const measured =
            zoneWidth > rect.width + 0.5 || zoneHeight > rect.height + 0.5
              ? `${size}, touch zone ${Math.round(zoneWidth)} × ${Math.round(zoneHeight)}`
              : size;

          const inText = target.matches(linkLike) && target.closest(inTextScope) !== null;
          if (inText) {
            const nearest = boxes.reduce(
              (least, other, position) =>
                position === index ? least : Math.min(least, gap(rect, other)),
              Number.POSITIVE_INFINITY,
            );
            if (nearest >= SEPARATION) return;
            report.smallTargets.push(
              `${label(target)} · ${measured} · ${Math.round(nearest)} px from the next target`,
            );
            return;
          }

          report.smallTargets.push(`${label(target)} · ${measured}`);
        });
      }

      return report;
    },
    {
      touchTarget: TOUCH_TARGET,
      minFontSize: MIN_FONT_SIZE,
      checkTargets: touch,
      chevronShapes: CHEVRONS,
      notAChevron: NOT_A_CHEVRON,
      linkLike: LINK_LIKE,
      inTextScope: IN_TEXT,
    },
  );
}

// The routes of §14.4 and the results page of Buscar with a query (M10, `queryRoutes`).
for (const route of [...testRoutes, ...queryRoutes]) {
  test(`the page contract holds on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    if (route.ready) await page.locator(route.ready).waitFor();
    const width = page.viewportSize()?.width ?? TOUCH_VIEWPORT;
    const report = await readContract(page, width < TOUCH_VIEWPORT);

    expect.soft(report.eyebrows, 'no .eyebrow element (G1)').toEqual([]);
    expect
      .soft(report.headingPreambles, 'nothing but the breadcrumb before the h1 (G1)')
      .toEqual([]);
    expect
      .soft(report.strayKeycaps, 'every visible kbd belongs to a SearchTrigger (PZ-02)')
      .toEqual([]);
    expect.soft(report.strayChevrons, 'every visible chevron opens something (G8)').toEqual([]);
    expect.soft(report.themeButtons, 'no theme button while there is one theme (X2)').toEqual([]);
    expect.soft(report.smallText, `no visible text below ${MIN_FONT_SIZE}px (U-02)`).toEqual([]);
    expect
      .soft(
        report.smallTargets,
        `every interactive target is ${TOUCH_TARGET} × ${TOUCH_TARGET}, hit area included (S14)`,
      )
      .toEqual([]);
    // §14.3: «hay un solo `role="search"` por página». It is a uniqueness bound, not a
    // requirement that every page carry one: §12.21 decision 9 pairs it with «el Inicio
    // no lleva buscador en la cabecera», and the only page the spec gives a search region
    // to is `/{l}/buscar/` (§8.6, point 2). Two landmarks on one page is the defect this
    // catches — M10 lands the one real region and this still holds.
    expect
      .soft(report.searchRegions, 'never two role="search" on one page (§14.3, §12.21-9)')
      .toBeLessThanOrEqual(1);
  });

  test(`Ctrl + K and Meta + K open the search palette on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);

    const trigger = page.locator('[data-ac-search-open]:visible').first();
    test.skip((await trigger.count()) === 0, 'This route has no visible SearchTrigger yet.');

    const palette = page.locator('dialog#buscar-dialogo');
    await expect(palette, 'a visible SearchTrigger means the palette exists (S11)').toBeAttached();

    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();

    // §7.9.2: one Escape closes it. With text in the field this is a different case: the
    // field is an `input[type="search"]` (DS:TextField variant="search") and Chromium
    // spends the first Escape on such a field clearing it, so the key never reaches the
    // dialog. Pressing Escape on an empty palette passes even when a page needs two.
    await page.locator('#buscar-campo').fill('a');
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();

    await page.keyboard.press('Meta+k');
    await expect(palette).toBeVisible();
  });
}

// --------------------------------------------------------------------------- S11

// S11: «cada `button`, `a[href]`, `[role="button"]` y `[role="tab"]` visible y habilitado
// produce un efecto comprobable: navega, cambia un estado, abre algo o copia. 0 elementos
// con aspecto de control y `aria-hidden="true"`». In F1 the criterion covers the
// components, which live on the parity routes (§2, «Criterios por fase»); F2 widens it to
// the routes of each phase, and this list is where that happens.
//
// How a control is tried. A link is not clicked: it navigates when its destination
// exists, so a fragment has to name an element of the page and a path of this site has
// to answer (after its redirections) with a success. Every other control is pressed on a
// fresh load of the page, with the storage of the last load cleared, so no state a
// previous press left — an open panel, a view kept in `localStorage`, a removed notice —
// decides what the next one does. The page is watched from just before the press: a
// change of its DOM, a popover or `details` that toggles, the history API, a new window,
// a form sent, the focus moved elsewhere, a scroll, or the clipboard. The clipboard is
// answered by the probe and never reached. A control that is already on (`aria-pressed`,
// `aria-selected` or `aria-checked` true) does nothing when it is pressed again by
// design, so another option of its group is pressed first and the control has to take
// the state back.
//
// What the watch ignores, because the page does it on its own: the `data-state` that
// src/scripts/art-loading.ts writes on art as it arrives, the attributes Astro writes on
// an `astro-island` as it hydrates, the `<head>`, and an attribute written again with the
// value it had. The test itself writes nothing to the DOM: the control it presses is
// kept as a reference in the page, since an attribute written before React finishes
// hydrating an island is a hydration mismatch.

const S11_ROUTES: TestRoute[] = testRoutes.filter((route) => esRutaParidad(route.path));

/** The controls S11 names. A `button` or a role, pressed; a link, followed. */
const S11_CONTROLS = 'button, a[href], [role="button"], [role="tab"]';

/** What exposes a control to assistive technology, or makes it one (S11, second part). */
const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [contenteditable=""],' +
  ' [contenteditable="true"], [tabindex]:not([tabindex="-1"]), [role="button"], [role="tab"],' +
  ' [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"],' +
  ' [role="option"], [role="combobox"], [role="slider"], [role="spinbutton"]';

/**
 * Where a pointer cursor is the control's own and not a look: inside a control, and inside
 * the `label` that forwards a press to its field.
 */
const CONTROL_CONTEXT = `${INTERACTIVE}, label`;

/** Class names of the reference that only a control carries (DS:Button, the triggers). */
const CONTROL_CLASSES =
  '[class*="ac-button"], [class*="__trigger"], [class*="__button"], [class*="__toggle"],' +
  ' [class*="__close"], [class*="__step"]';

/** The page has this long to show an effect; the controllers answer within a frame. */
const EFFECT_WAIT = 1500;

/** How long a press waits for its control to be there and ready to take it. */
const ACTION_TIMEOUT = 5000;

/** A press starts once the page has been quiet this long, and never waits longer than the cap. */
const QUIET = 150;
const QUIET_CAP = 2000;

/**
 * The time S11 has on a route: at least `S11_TIMEOUT`, and `S11_PER_PRESS` more for every
 * control it presses, because each press is a fresh load of the page. The Tarjetas board
 * draws some thirty such controls over dozens of islands, and on a development server shared
 * with other workers one load can take several seconds: a fixed budget cut that route short
 * while it was still pressing (4.1 min against 240 s), not because a control failed.
 */
const S11_TIMEOUT = 240_000;
const S11_BASE = 60_000;
const S11_PER_PRESS = 10_000;

type ControlEntry = {
  /** Position among the visible and enabled controls of the page, in DOM order. */
  index: number;
  label: string;
  link: boolean;
  /** For a link: its resolved `href`. */
  href: string;
  /** For a link: whether it only moves inside this document. */
  fragment: boolean;
  /** For a fragment: whether the element it names exists. */
  targetExists: boolean;
};

type S11Window = Window & {
  __acS11?: { start: (control: Element) => void; effects: () => string[]; stop: () => void };
  /** The control of the current press and, when it is already on, the option pressed first. */
  __acS11Marks?: { target: Element | null; partner: Element | null };
};

/**
 * The probe of S11, as an init script: it runs on every document of the page before any of
 * the page's own scripts, and does nothing until `start` names the control being pressed.
 * Self-contained, because Playwright serialises it into the page.
 */
function installEffectProbe(): void {
  // Each press starts from a page without the state of the last one (see above).
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Storage refused: nothing was kept either.
  }

  let recording = false;
  let control: Element | null = null;
  let effects: string[] = [];

  const describe = (target: EventTarget | Node | null): string => {
    if (!(target instanceof Element)) return target instanceof Node ? target.nodeName : 'window';
    const id = target.id === '' ? '' : `#${target.id}`;
    const first = (target.getAttribute('class') ?? '').trim().split(/\s+/)[0] ?? '';
    return `${target.localName}${id}${first === '' ? '' : `.${first}`}`;
  };
  const note = (effect: string): void => {
    if (recording && effects.length < 12) effects.push(effect);
  };

  // «copia». The clipboard is answered here and never reached.
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard !== undefined) {
    for (const method of ['writeText', 'write'] as const) {
      Object.defineProperty(clipboard, method, {
        configurable: true,
        value: () => {
          note(`copies (clipboard.${method})`);
          return Promise.resolve();
        },
      });
    }
  }
  // The older road to the clipboard, reached by name: the method is deprecated, and a copy
  // through it is still a copy.
  type ExecCommand = (command: string, ...rest: unknown[]) => boolean;
  const execCommand = Reflect.get(document, 'execCommand') as ExecCommand;
  Reflect.set(document, 'execCommand', (command: string, ...rest: unknown[]): boolean => {
    if (/^(?:copy|cut)$/i.test(command)) {
      note(`copies (execCommand ${command})`);
      return true;
    }
    return execCommand.call(document, command, ...rest);
  });

  // «navega».
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    history[method] = (data: unknown, unused: string, url?: string | URL | null): void => {
      note(`history.${method} ${String(url ?? '')}`);
      original(data, unused, url);
    };
  }
  window.open = (url?: string | URL): WindowProxy | null => {
    note(`window.open ${String(url ?? '')}`);
    return null;
  };
  window.addEventListener('hashchange', () => note('hashchange'));
  document.addEventListener(
    'submit',
    (event) => {
      note(`submits ${describe(event.target)}`);
      event.preventDefault();
    },
    true,
  );
  window.addEventListener('scroll', (event) => note(`scrolls ${describe(event.target)}`), true);

  // «abre algo»: a popover or a `details` that opens or closes.
  document.addEventListener('toggle', (event) => note(`toggles ${describe(event.target)}`), true);
  document.addEventListener(
    'focusin',
    (event) => {
      if (control !== null && event.target instanceof Node && control.contains(event.target)) {
        return;
      }
      note(`moves the focus to ${describe(event.target)}`);
    },
    true,
  );

  // «cambia un estado»: the DOM, without what the page does on its own.
  const counts = (record: MutationRecord): boolean => {
    const target = record.target;
    if (document.head.contains(target)) return false;
    if (record.type === 'attributes') {
      const element = target as Element;
      const name = record.attributeName ?? '';
      if (name === 'data-state' && element.localName === 'img') return false;
      if (element.localName === 'astro-island') return false;
      return element.getAttribute(name) !== record.oldValue;
    }
    if (record.type === 'characterData') return (target as CharacterData).data !== record.oldValue;
    return record.addedNodes.length > 0 || record.removedNodes.length > 0;
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (!counts(record)) continue;
      const attribute = record.attributeName === null ? '' : `[${record.attributeName}]`;
      note(`changes ${describe(record.target)}${attribute}`);
    }
  });

  (window as S11Window).__acS11 = {
    start(element: Element) {
      control = element;
      effects = [];
      recording = true;
      observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        childList: true,
        characterData: true,
        characterDataOldValue: true,
      });
    },
    effects: () => [...effects],
    stop() {
      recording = false;
      observer.disconnect();
    },
  };
}

/** Astro drops `ssr` from an island once it has hydrated; until then its controls are inert. */
async function islandsHydrated(page: Page): Promise<void> {
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
}

/** Resolves once the DOM has been quiet for `QUIET` ms, or after `QUIET_CAP` ms at most. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    ({ quiet, cap }) =>
      new Promise<void>((resolve) => {
        let timer = 0;
        let limit = 0;
        const observer = new MutationObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(finish, quiet);
        });
        function finish(): void {
          observer.disconnect();
          window.clearTimeout(timer);
          window.clearTimeout(limit);
          resolve();
        }
        observer.observe(document.documentElement, {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        });
        timer = window.setTimeout(finish, quiet);
        limit = window.setTimeout(finish, cap);
      }),
    { quiet: QUIET, cap: QUIET_CAP },
  );
}

/**
 * The visible and enabled controls of the page, in DOM order. With `mark`, the control at
 * that position and, when it is already on, another option of its group are kept in
 * `__acS11Marks` for the press. The list is the same on every load of a route: the storage
 * is cleared first, so nothing a press kept decides what is shown.
 */
async function listControls(
  page: Page,
  mark: number | null,
): Promise<{ controls: ControlEntry[]; primed: boolean }> {
  return page.evaluate(
    ({ selector, markAt }) => {
      const visible = (element: Element): boolean => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return element.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        });
      };
      const enabled = (element: Element): boolean =>
        !element.matches(':disabled') &&
        element.getAttribute('aria-disabled') !== 'true' &&
        element.closest('[inert]') === null;
      const label = (element: Element): string => {
        const text = (element.getAttribute('aria-label') ?? element.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40);
        const first = (element.getAttribute('class') ?? '').trim().split(/\s+/)[0] ?? '';
        return `${element.localName}${first === '' ? '' : `.${first}`}${text === '' ? '' : ` «${text}»`}`;
      };
      const STATES = ['aria-pressed', 'aria-selected', 'aria-checked'];
      const stateOf = (element: Element): string | null =>
        STATES.find((name) => element.getAttribute(name) === 'true') ?? null;

      const elements = Array.from(document.querySelectorAll(selector)).filter(
        (element) => visible(element) && enabled(element),
      );
      const here = new URL(window.location.href);
      const controls = elements.map((element, index) => {
        const link = element.localName === 'a' && element.hasAttribute('href');
        const raw = link ? (element.getAttribute('href') ?? '') : '';
        const url = link ? new URL(raw, here) : null;
        const fragment =
          url !== null &&
          url.origin === here.origin &&
          url.pathname === here.pathname &&
          url.search === here.search &&
          raw.includes('#');
        const id = fragment && url !== null ? decodeURIComponent(url.hash.slice(1)) : '';
        return {
          index,
          label: label(element),
          link,
          href: url === null ? '' : raw.trim() === '' ? '' : url.href,
          fragment,
          targetExists:
            fragment &&
            id !== '' &&
            (document.getElementById(id) !== null || document.getElementsByName(id).length > 0),
        };
      });

      const marks: { target: Element | null; partner: Element | null } = {
        target: null,
        partner: null,
      };
      if (markAt !== null) {
        const target = elements[markAt];
        if (target !== undefined) {
          marks.target = target;
          const state = stateOf(target);
          if (state !== null) {
            const group =
              target.closest(
                '[role="group"], [role="radiogroup"], [role="tablist"], [role="toolbar"], fieldset',
              ) ?? target.parentElement;
            marks.partner =
              elements.find(
                (element) =>
                  element !== target &&
                  group !== null &&
                  group.contains(element) &&
                  element.getAttribute(state) === 'false',
              ) ?? null;
          }
        }
      }
      (window as S11Window).__acS11Marks = marks;
      return { controls, primed: marks.partner !== null };
    },
    { selector: S11_CONTROLS, markAt: mark },
  );
}

/** The element `__acS11Marks` keeps under `which`, as a handle, or null. */
async function marked(
  page: Page,
  which: 'target' | 'partner',
): Promise<ElementHandle<Element> | null> {
  const handle = await page.evaluateHandle(
    (key) => (window as S11Window).__acS11Marks?.[key] ?? null,
    which,
  );
  return handle.asElement() as ElementHandle<Element> | null;
}

/** Opens the route as a first visit would find it, with its islands hydrated. */
async function freshLoad(page: Page, path: string): Promise<void> {
  // A pointer left on a trigger by the last press would open or close a panel on arrival.
  await page.mouse.move(0, 0);
  await page.goto(path);
  await islandsHydrated(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Presses the control of `entry` on a fresh load and returns what the page did: the
 * effects it saw (none when the press did nothing), or the reason the press could not be
 * made.
 */
async function press(page: Page, path: string, entry: ControlEntry): Promise<string[] | string> {
  await freshLoad(page, path);
  const { controls, primed } = await listControls(page, entry.index);
  const current = controls[entry.index];
  if (current === undefined || current.label !== entry.label) {
    return `the page drew other controls on a new load (found ${current?.label ?? 'nothing'})`;
  }

  const target = await marked(page, 'target');
  if (target === null) return 'could not be found again on a new load';
  try {
    if (primed) {
      const partner = await marked(page, 'partner');
      await partner?.click({ timeout: ACTION_TIMEOUT });
      await page.mouse.move(0, 0);
    }
    await target.scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT });
    // A `client:visible` island hydrates once it is scrolled to.
    await expect
      .poll(() => target.evaluate((element) => element.closest('astro-island[ssr]') !== null), {
        message: 'the island of the control hydrates',
        timeout: ACTION_TIMEOUT,
      })
      .toBe(false);
    await settle(page);
  } catch (error) {
    // The control went away before it could be pressed: an island that painted it again
    // without it, or a press of its group that removed it.
    return `could not be reached: ${(error as Error).message.split('\n')[0]}`;
  }

  const before = page.url();
  let navigated = false;
  const onNavigation = (frame: unknown) => {
    if (frame === page.mainFrame()) navigated = true;
  };
  page.on('framenavigated', onNavigation);
  try {
    await target.evaluate((element) => (window as S11Window).__acS11?.start(element));
    try {
      await target.click({ timeout: ACTION_TIMEOUT });
    } catch (error) {
      return `cannot be pressed: ${(error as Error).message.split('\n')[0]}`;
    }

    const deadline = Date.now() + EFFECT_WAIT;
    for (;;) {
      if (navigated || page.url() !== before) return [`navigates to ${page.url()}`];
      let effects: string[];
      try {
        effects = await page.evaluate(() => (window as S11Window).__acS11?.effects() ?? []);
      } catch {
        // The document went away under the probe: the press navigated.
        return ['navigates'];
      }
      if (effects.length > 0) return effects;
      if (Date.now() >= deadline) return [];
      await page.waitForTimeout(50);
    }
  } finally {
    page.off('framenavigated', onNavigation);
    await page
      .evaluate(() => (window as S11Window).__acS11?.stop())
      .catch(() => {
        // The document is gone, and its probe with it.
      });
  }
}

/** Every visible element that looks like a control and is hidden from assistive technology. */
async function hiddenControls(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ interactive, context, classes }) => {
      const visible = (element: Element): boolean =>
        element.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        });
      // Something with no box has no look at all, of a control or of anything else.
      const drawn = (element: Element): boolean => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const label = (element: Element): string => {
        const text = (element.getAttribute('aria-label') ?? element.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40);
        const first = (element.getAttribute('class') ?? '').trim().split(/\s+/)[0] ?? '';
        return `${element.localName}${first === '' ? '' : `.${first}`}${text === '' ? '' : ` «${text}»`}`;
      };

      const found: string[] = [];
      for (const root of document.querySelectorAll('[aria-hidden="true"]')) {
        // The outermost hidden root; what is inside it is read from there.
        if (root.parentElement?.closest('[aria-hidden="true"]')) continue;
        // Decoration of a real control — the glyph of a button, the sprite of a slot —
        // takes the control's cursor and is hidden so the control keeps one name.
        const parent = root.parentElement;
        const decoration = parent !== null && parent.closest(context) !== null;
        for (const element of [root, ...root.querySelectorAll('*')]) {
          if (!visible(element)) continue;
          if (element.matches(interactive)) {
            found.push(`${label(element)} · a control inside aria-hidden`);
            continue;
          }
          if (decoration || !drawn(element)) continue;
          if (element.matches(classes)) {
            found.push(`${label(element)} · the class of a control, hidden`);
          } else if (getComputedStyle(element).cursor === 'pointer') {
            found.push(`${label(element)} · a pointer cursor, hidden`);
          }
        }
      }
      return found;
    },
    { interactive: INTERACTIVE, context: CONTROL_CONTEXT, classes: CONTROL_CLASSES },
  );
}

for (const route of S11_ROUTES) {
  test(`every visible control does something on ${route.path} (S11)`, async ({ page }) => {
    // One load per control, each with its own quiet period and its wait for an effect; the
    // budget grows once the controls are counted (`S11_PER_PRESS`).
    test.setTimeout(S11_TIMEOUT);
    await page.addInitScript(installEffectProbe);

    await freshLoad(page, route.path);
    expect
      .soft(await hiddenControls(page), 'nothing that looks like a control is aria-hidden (S11)')
      .toEqual([]);

    const { controls } = await listControls(page, null);
    expect(controls.length, 'the parity route draws controls').toBeGreaterThan(0);
    const presses = controls.filter((candidate) => !candidate.link).length;
    test.setTimeout(Math.max(S11_TIMEOUT, S11_BASE + presses * S11_PER_PRESS));

    // Links: a real destination.
    const dead: string[] = [];
    const checked = new Map<string, string | null>();
    for (const entry of controls.filter((candidate) => candidate.link)) {
      if (entry.href === '' || /^javascript:/i.test(entry.href)) {
        dead.push(`${entry.label} · leads nowhere («${entry.href}»)`);
        continue;
      }
      if (entry.fragment) {
        if (!entry.targetExists) dead.push(`${entry.label} · ${entry.href} names no element`);
        continue;
      }
      const url = new URL(entry.href);
      if (url.origin !== new URL(page.url()).origin) continue;
      url.hash = '';
      if (!checked.has(url.href)) {
        try {
          const response = await page.request.get(url.href, { timeout: 60_000 });
          checked.set(url.href, response.ok() ? null : `answers ${response.status()}`);
        } catch (error) {
          checked.set(url.href, `does not answer: ${(error as Error).message.split('\n')[0]}`);
        }
      }
      const problem = checked.get(url.href);
      if (problem !== null && problem !== undefined) {
        dead.push(`${entry.label} · ${url.pathname}${url.search} ${problem}`);
      }
    }

    // Everything else: pressed, one fresh load each.
    for (const entry of controls.filter((candidate) => !candidate.link)) {
      const effects = await press(page, route.path, entry);
      if (typeof effects === 'string') dead.push(`${entry.label} · ${effects}`);
      else if (effects.length === 0) dead.push(`${entry.label} · nothing happens when pressed`);
    }

    expect
      .soft(dead, 'every visible, enabled control navigates, changes, opens or copies (S11)')
      .toEqual([]);
  });
}
