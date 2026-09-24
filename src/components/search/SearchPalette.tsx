// The Ctrl + K palette of spec 7.9: one `client:idle` island per page, inside
// PageLayout. It is the other half of `SearchTrigger` (spec 7.10.1) — without it
// the trigger would be a control that does nothing (S11, R12).
//
// Composed only with pieces and tokens of the design system (R16, E11): there is
// no board for it. Its texts arrive as props, from the dictionary of the page
// (DP1, spec 13.2); the component carries no copy of its own.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { layout, spacing } from '@/lib/design/shell-tokens';
import { rankSearch, type SearchEntry, type SearchKind } from '@/lib/search/rank';

/**
 * Contract with src/scripts/search-shortcut.ts, which answers Ctrl + K and the
 * clicks on a trigger before this island hydrates. The script repeats these four
 * names with the same comment.
 */
const OPEN_EVENT = 'ac:search-open';
const MODAL_EVENT = 'ac:modal-open';
const TRIGGER = '[data-ac-search-open]';
const READY = 'acSearch';
const PENDING = 'acSearchPending';

/**
 * The phone lens of the header (spec 7.10.1). `SearchTrigger` writes
 * `data-ac-search-open` with no value, so the shape of a trigger is read from
 * the class of the design system, which C7-02 pins down.
 */
const ICON_TRIGGER = 'ac-search-trigger--icon';

const DIALOG_ID = 'buscar-dialogo';
const FIELD_ID = 'buscar-campo';
const RESULTS_ID = 'buscar-resultados';
const ALL_OPTION_ID = 'buscar-opcion-todos';

/** Frame measurements of spec 7.9.3, from the one source of tokens. */
const px = (value: string): number => Number.parseInt(value, 10);
const PANEL_WIDTH = px(layout.layoutSearch);
const HEADER = px(layout.layoutHeader);
const BP_MD = px(layout.layoutBpMd);
const MARGIN = px(spacing.space16);
const PHONE_TOP = px(spacing.space8);

/** Longest query the field takes (spec 8.6). */
const MAX_QUERY = 100;

export interface SearchPaletteMessages {
  /** Accessible name of the dialog: «Buscar» / «Search». */
  label: string;
  /** Placeholder of the field: «Buscar...» / «Search...». */
  placeholder: string;
  /** Accessible name of the result list: «Resultados» / «Results». */
  results: string;
  /** Heading of each group, in the words of the table of spec 8.6. */
  groups: Record<SearchKind, string>;
  /** «Sin resultados para «{q}».» / «No results for “{q}”.» */
  empty: string;
  /** «No se pudo cargar la búsqueda.» / «Couldn't load search.» */
  error: string;
  /** «Ver todos los resultados de «{q}»» / «See all results for “{q}”» */
  seeAll: string;
}

export interface SearchPaletteProps {
  locale: Locale;
  messages: SearchPaletteMessages;
  /**
   * The 16 px magnifier of the field (C-R7), drawn by `PageLayout` on the server and handed
   * in as the `glyph` slot. The island never imports `Glyph`: that module holds lucide's
   * `Icon` and every shape, and this island is in the initial JavaScript of every page
   * (13.6).
   */
  glyph?: ReactNode;
}

/**
 * The index of spec 7.9.1, kept in the memory of the module: it is downloaded on
 * the first opening and reused by every later one. A failed request leaves
 * nothing behind, so reopening the palette asks again (spec 8.6).
 */
let cache: SearchEntry[] | null = null;
let request: Promise<SearchEntry[]> | null = null;

function loadIndex(url: string): Promise<SearchEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (!request) {
    request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<SearchEntry[]>;
      })
      .then((entries) => {
        cache = entries;
        return entries;
      })
      .catch((error: unknown) => {
        request = null;
        throw error;
      });
  }
  return request;
}

interface Anchor {
  left: number;
  top: number;
  width: number;
}

/** Spec 7.9.2: `checkVisibility()`, with the rectangle test where it is missing. */
function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility()
    : element.getClientRects().length > 0;
}

/**
 * The trigger a request parked before hydration came from: the visible one of
 * that variant, or any visible one.
 */
function triggerOfVariant(variant: string): HTMLElement | null {
  let fallback: HTMLElement | null = null;
  for (const element of document.querySelectorAll<HTMLElement>(TRIGGER)) {
    if (!isVisible(element)) continue;
    if (element.dataset.acSearchOpen === variant) return element;
    fallback ??= element;
  }
  return fallback;
}

/**
 * Where the panel opens (spec 7.9.3). Anchored to the trigger that opened it —
 * same left, same top, its width with a minimum of `layout-search`. A trigger
 * that is not whole inside the window (the one of the home page after scrolling)
 * does not anchor: the panel is centred under the header. With the `icon`
 * trigger or below 768 it takes the width of the window minus its margins.
 */
function computeAnchor(trigger: HTMLElement | null): Anchor {
  const view = { width: window.innerWidth, height: window.innerHeight };

  if (view.width < BP_MD || trigger?.classList.contains(ICON_TRIGGER) === true) {
    return { left: MARGIN, top: PHONE_TOP, width: Math.max(view.width - MARGIN * 2, 0) };
  }

  const rect = trigger?.getBoundingClientRect();
  const whole =
    rect !== undefined &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= view.height &&
    rect.right <= view.width;

  if (rect && whole) {
    const width = Math.max(rect.width, PANEL_WIDTH);
    // The panel may be wider than its trigger, so it is held inside the window.
    const last = Math.max(view.width - width - MARGIN, MARGIN);
    return { left: Math.min(Math.max(rect.left, MARGIN), last), top: rect.top, width };
  }

  const width = Math.min(PANEL_WIDTH, Math.max(view.width - MARGIN * 2, 0));
  return { left: Math.round((view.width - width) / 2), top: HEADER + MARGIN, width };
}

/**
 * Placement on the panel itself as three --ac-* properties, the data-driven
 * values spec 3.7 allows in `style`.
 */
function applyAnchor(dialog: HTMLDialogElement, anchor: Anchor): void {
  dialog.style.setProperty('--ac-palette-left', `${anchor.left}px`);
  dialog.style.setProperty('--ac-palette-top', `${anchor.top}px`);
  dialog.style.setProperty('--ac-palette-width', `${anchor.width}px`);
}

function optionId(kind: SearchKind, id: string): string {
  return `buscar-opcion-${kind}-${id}`;
}

export function SearchPalette({ locale, messages, glyph }: SearchPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[] | null>(cache);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  const indexUrl = `/${locale}/buscar/indice.json`;
  const text = query.trim();
  const allHref = `/${locale}/buscar/?q=${encodeURIComponent(text)}`;

  const groups = useMemo(
    () => (entries ? rankSearch(entries, query, locale) : []),
    [entries, query, locale],
  );

  const options = useMemo(() => {
    const list: { id: string; href: string }[] = [];
    for (const group of groups) {
      for (const entry of group.entries) {
        list.push({ id: optionId(group.kind, entry.id), href: entry.href });
      }
    }
    // Spec 7.9.3: with a query, the last option of the listbox goes to the
    // results page. With no results there is no listbox, only the empty line.
    if (list.length > 0) list.push({ id: ALL_OPTION_ID, href: allHref });
    return list;
  }, [groups, allHref]);

  const indexOfOption = useMemo(
    () => new Map(options.map((option, index) => [option.id, index])),
    [options],
  );

  const activeIndex = options.length > 0 ? Math.min(active, options.length - 1) : -1;

  const openPalette = useCallback(
    (trigger: HTMLElement | null) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      // Spec 7.9.2: Ctrl + K with the palette open closes it.
      if (dialog.open) {
        dialog.close();
        return;
      }

      triggerRef.current = trigger;
      // Written straight to the element, not through React: the panel has to
      // carry its placement in the same frame `showModal()` shows it.
      applyAnchor(dialog, computeAnchor(trigger));
      dialog.showModal();
      setOpen(true);
      inputRef.current?.select();
      // TT12: a modal that opens closes every tooltip, pinned ones included.
      dialog.dispatchEvent(new CustomEvent(MODAL_EVENT, { bubbles: true }));

      if (!cache) {
        setFailed(false);
        loadIndex(indexUrl).then(
          (list) => setEntries(list),
          () => setFailed(true),
        );
      }
    },
    [indexUrl],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset[READY] = 'ready';

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ trigger?: HTMLElement | null }>).detail;
      openPalette(detail?.trigger ?? null);
    };
    document.addEventListener(OPEN_EVENT, onOpen);

    // A click or a shortcut from before this island mounted (C7-11).
    if (PENDING in root.dataset) {
      const variant = root.dataset[PENDING] ?? '';
      delete root.dataset[PENDING];
      openPalette(triggerOfVariant(variant));
    }

    return () => {
      document.removeEventListener(OPEN_EVENT, onOpen);
      delete root.dataset[READY];
    };
  }, [openPalette]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => {
      const dialog = dialogRef.current;
      if (dialog) applyAnchor(dialog, computeAnchor(triggerRef.current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // The list scrolls inside the panel, so the arrows have to bring the active
  // option along. `nearest` does not move anything that is already in view and
  // never animates, so reduced motion needs nothing here (S15).
  useEffect(() => {
    const id = options[activeIndex]?.id;
    if (!open || id === undefined) return;
    document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, options]);

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    // A click with no pointer behind it (`detail === 0`, the one a keyboard sends)
    // reports 0, 0 and is never a click on the veil.
    if (event.detail === 0) return;
    // A click on the veil reaches the dialog with coordinates outside its box.
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  }

  function onDialogClose() {
    setOpen(false);
    setQuery('');
    setActive(0);
    triggerRef.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Spec 7.9.2: Escape closes the palette. The field is a `TextField
    // variant="search"`, so it is an `input[type="search"]` like the design
    // system's, and in Chromium the first Escape on such a field is spent
    // clearing it: the key never reaches the dialog, the native `cancel` does
    // not fire and the panel stays open until a second Escape. Closing it here
    // makes one Escape enough in every engine, and the dialog still gives the
    // focus back to whoever opened it.
    if (event.key === 'Escape') {
      event.preventDefault();
      dialogRef.current?.close();
      return;
    }
    if (options.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((activeIndex + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((activeIndex - 1 + options.length) % options.length);
    } else if (event.key === 'Enter') {
      const option = options[activeIndex];
      if (!option) return;
      event.preventDefault();
      window.location.assign(option.href);
    }
  }

  const loading = entries === null && !failed;
  const showEmpty = text.length > 0 && !loading && options.length === 0;

  return (
    <dialog
      ref={dialogRef}
      id={DIALOG_ID}
      className="ac-search-palette"
      aria-label={messages.label}
      onClick={onDialogClick}
      onClose={onDialogClose}
    >
      {/* No `role="search"` here. A closed `<dialog>` is `display: none`, so a landmark
          inside it is out of the accessibility tree and would be a region no reader can
          ever reach — a control that only exists to be counted. The spec asks for a search
          region on `/{l}/buscar/` and nowhere else (§8.6, point 2); «un solo `role="search"`
          por página» (§14.3, decision 9 of §12.21) is the bound that keeps the Inicio from
          carrying a second one. The input below is a `combobox`, which is what names this
          field for a reader. */}
      <div className="ac-search-palette__field">
        {/* The magnifier of 16 (C-R7), from the server (`glyph`). */}
        {glyph}
        <input
          ref={inputRef}
          id={FIELD_ID}
          className="ac-search-palette__input"
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY}
          placeholder={messages.placeholder}
          aria-label={messages.label}
          aria-expanded={options.length > 0}
          aria-controls={options.length > 0 ? RESULTS_ID : undefined}
          aria-autocomplete="list"
          aria-activedescendant={options[activeIndex]?.id}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {showEmpty ? (
        <p className="ac-search-palette__empty">
          {failed ? messages.error : fill(messages.empty, { q: text })}
        </p>
      ) : null}

      {options.length > 0 ? (
        <div
          id={RESULTS_ID}
          className="ac-search-palette__results"
          role="listbox"
          aria-label={messages.results}
        >
          {groups.map((group) => (
            <div
              key={group.kind}
              className="ac-search-palette__group"
              role="group"
              aria-labelledby={`buscar-grupo-${group.kind}`}
            >
              <p id={`buscar-grupo-${group.kind}`} className="ac-search-palette__group-label">
                {messages.groups[group.kind]}
              </p>
              {group.entries.map((entry) => {
                const id = optionId(group.kind, entry.id);
                const index = indexOfOption.get(id) ?? -1;
                return (
                  <a
                    key={id}
                    id={id}
                    className="ac-search-palette__option"
                    role="option"
                    aria-selected={index === activeIndex}
                    href={entry.href}
                    onMouseEnter={() => setActive(index)}
                  >
                    <span className="ac-search-palette__cell">
                      {/* M4 draws this with the game <Sprite> (spec 7.4); today the index
                          carries illustrations only, which are a plain 24 px image. */}
                      {entry.icon?.smooth ? (
                        <img
                          className="ac-search-palette__art"
                          src={entry.icon.src}
                          width={entry.icon.width}
                          height={entry.icon.height}
                          alt=""
                          loading="lazy"
                        />
                      ) : null}
                    </span>
                    <span className="ac-search-palette__name">{entry.name}</span>
                    {entry.meta === undefined ? null : (
                      <span className="ac-search-palette__meta">{entry.meta}</span>
                    )}
                  </a>
                );
              })}
            </div>
          ))}
          <a
            id={ALL_OPTION_ID}
            className="ac-search-palette__option ac-search-palette__option--all"
            role="option"
            aria-selected={activeIndex === options.length - 1}
            href={allHref}
            onMouseEnter={() => setActive(options.length - 1)}
          >
            <span className="ac-search-palette__name">{fill(messages.seeAll, { q: text })}</span>
          </a>
        </div>
      ) : null}
    </dialog>
  );
}
