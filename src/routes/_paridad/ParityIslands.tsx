import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/controls/Button';
import { Combobox, type ComboboxOption } from '@/components/controls/Combobox';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Pagination, type PaginationLabels } from '@/components/controls/Pagination';
import { Textarea } from '@/components/controls/Textarea';
import { Notice } from '@/components/content/Notice';

// The islands of `/_paridad/componentes/` (src/routes/_paridad/componentes.astro). The
// design system components are server-rendered TSX that only act through their props, and a
// control a page paints without an action is a fake one (S11, C-R5): a `pressed` Button, a
// Notice that closes, a Combobox that filters, a Pagination that marks the page it leads to
// and a Dialog with its trigger all need React on the client. Each export here is the
// smallest owner of that state, so the parity route shows every control of 7.2.2, 7.2.3 and
// 7.2.8 working and the e2e gates of 14.3 (axe, keyboard, contract) reach them.
//
// Nothing here is a design of its own and nothing ships: this file lives beside the parity
// route, which only the visual build and the development server inject (astro.config.mjs).
// Every text arrives by props from the page, which reads the dictionary (DP1) and the board
// samples of tests/visual/fixtures/componentes.json (X4).

/** Fired on `document` when the coordinates are copied, so the Notice can show them again. */
const COPIED_EVENT = 'ac-paridad:copied';

/** The copy button, where the Notice hands the focus back when it closes (DS:Notice). */
const COPY_BUTTON_ID = 'copiar-coordenadas';

interface PeriodToggleProps {
  /** The two periods, in order («Por semana», «Por día»). */
  labels: [string, string];
}

/**
 * The pressed pair of DS:Button («Seleccionado · borde y anillo»): two `Button`s with
 * `aria-pressed`, one of them always chosen. The first one starts pressed, as on the board.
 */
export function PeriodToggle({ labels }: PeriodToggleProps) {
  const [chosen, setChosen] = useState(0);
  return (
    <div className="flex flex-wrap gap-8">
      {labels.map((label, index) => (
        <Button key={label} pressed={chosen === index} onClick={() => setChosen(index)}>
          {label}
        </Button>
      ))}
    </div>
  );
}

interface CopyCoordinatesProps {
  /** Text of the solid button («Copiar coordenadas»). */
  label: string;
  /** What goes to the clipboard. */
  text: string;
}

/**
 * The solid button of DS:Button: it copies the coordinates and, once they are on the
 * clipboard, tells the Notice. A browser that refuses the clipboard gets no Notice: it
 * would say «copiadas» about text that was not copied.
 */
export function CopyCoordinates({ label, text }: CopyCoordinatesProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    document.dispatchEvent(new CustomEvent(COPIED_EVENT));
  }
  return (
    <Button id={COPY_BUTTON_ID} variant="solid" onClick={() => void copy()}>
      {label}
    </Button>
  );
}

interface CopyNoticeProps {
  /** «Coordenadas copiadas: …». */
  message: string;
  /** `ui.dismiss`. */
  closeLabel: string;
}

/**
 * The Notice of the board, open on arrival; the close button hides it and a copy shows it.
 * DS:Notice: when the close button had the focus, the focus goes back to the control the
 * notice came from, the copy button, instead of falling to the body with the removed button.
 */
export function CopyNotice({ message, closeLabel }: CopyNoticeProps) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const show = () => setOpen(true);
    document.addEventListener(COPIED_EVENT, show);
    return () => document.removeEventListener(COPIED_EVENT, show);
  }, []);
  function close() {
    const focused = document.activeElement;
    const hadFocus = focused instanceof Element && focused.closest('.ac-notice') !== null;
    setOpen(false);
    if (hadFocus) document.getElementById(COPY_BUTTON_ID)?.focus();
  }
  return (
    <Notice open={open} onClose={close} closeLabel={closeLabel}>
      {message}
    </Notice>
  );
}

/** A record of the Pokémon registry, as the Combobox needs it. */
export interface PokemonEntry {
  id: string;
  name: string;
  /** Pokédex number (`numero`); `null` when the registry has none. */
  number: number | null;
}

interface PokemonComboboxProps {
  label: string;
  placeholder: string;
  /** The Pokémon registry, in its order. */
  pokemon: PokemonEntry[];
}

/** 7.2.8: the caller filters. The first twenty records that match. */
const MAX_MATCHES = 20;

/** A number, with or without «#» and leading zeros (11.3): «6», «#6», «006». */
const NUMBER_QUERY = /^#?\s*0*(\d+)$/;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/**
 * A Combobox over the Pokémon registry. It matches the way the Pokémon picker of 11.3
 * does, so the placeholder «Charizard o 6» holds: the name with accents and case ignored,
 * or the Pokédex number.
 */
export function PokemonCombobox({ label, placeholder, pokemon }: PokemonComboboxProps) {
  const [text, setText] = useState('');
  const options = useMemo<ComboboxOption[]>(() => {
    const query = fold(text.trim());
    if (query === '') return [];
    const digits = NUMBER_QUERY.exec(query)?.[1];
    const wanted = digits === undefined ? null : Number(digits);
    const matches: ComboboxOption[] = [];
    for (const entry of pokemon) {
      const hit = wanted === null ? fold(entry.name).includes(query) : entry.number === wanted;
      if (!hit) continue;
      matches.push({ value: entry.id, label: entry.name });
      if (matches.length === MAX_MATCHES) break;
    }
    return matches;
  }, [pokemon, text]);
  return (
    <Combobox
      label={label}
      placeholder={placeholder}
      options={options}
      value={text}
      onChange={setText}
    />
  );
}

interface PagedPaginationProps {
  /** Number of pages of the board's sample. */
  pageCount: number;
  labels: PaginationLabels;
  ariaLabel: string;
  /** This route, which is page 1; page n is `?page=n` of it (7.7.2). */
  path: string;
}

/** The page the address asks for: `?page=n` within 1…count, page 1 otherwise. */
function pageFromAddress(count: number): number {
  const asked = Number(new URLSearchParams(window.location.search).get('page') ?? '1');
  return Number.isInteger(asked) && asked >= 1 && asked <= count ? asked : 1;
}

/**
 * The Pagination of the board with the address as its state. The route is prerendered,
 * so the server marks page 1; once hydrated this marks the page `?page=n` asks for. A
 * plain click is taken the way the list controller takes it (7.7.3 H6): the address
 * changes and the current page moves without a reload, and Back and Forward follow it.
 * A click with a modifier is left to the browser, which opens the real `href`.
 */
export function PagedPagination({ pageCount, labels, ariaLabel, path }: PagedPaginationProps) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    const follow = () => setPage(pageFromAddress(pageCount));
    follow();
    window.addEventListener('popstate', follow);
    return () => window.removeEventListener('popstate', follow);
  }, [pageCount]);
  const hrefFor = (n: number) => (n === 1 ? path : `${path}?page=${n}`);
  return (
    <Pagination
      page={page}
      pageCount={pageCount}
      hrefFor={hrefFor}
      labels={labels}
      ariaLabel={ariaLabel}
      onPage={(n, event) => {
        event.preventDefault();
        if (n !== page) window.history.pushState(null, '', hrefFor(n));
        setPage(n);
      }}
    />
  );
}

interface DiscardExportProps {
  /** Label of the Textarea. */
  label: string;
  /** Text of the trigger and of the confirming action. */
  trigger: string;
  title: string;
  text: string;
  cancel: string;
  confirm: string;
  /** `ui.close`. */
  closeLabel: string;
}

/**
 * A Textarea and the confirmation that clears it: the generic contract of Dialog (7.2.8,
 * 9.9, 10.4) — `alertdialog`, the focus on «Cancelar» when it opens and back on the trigger
 * when it closes.
 */
export function DiscardExport({
  label,
  trigger,
  title,
  text,
  cancel,
  confirm,
  closeLabel,
}: DiscardExportProps) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-16">
      <Textarea label={label} rows={4} value={value} onChange={setValue} className="w-full" />
      <Button aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        closeLabel={closeLabel}
        alert
        actions={
          <>
            <Button {...initialFocus} onClick={() => setOpen(false)}>
              {cancel}
            </Button>
            <Button
              variant="solid"
              onClick={() => {
                setValue('');
                setOpen(false);
              }}
            >
              {confirm}
            </Button>
          </>
        }
      >
        {text}
      </Dialog>
    </div>
  );
}
