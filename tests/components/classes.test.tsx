import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { Chip } from '@/components/content/Chip';
import { Count } from '@/components/content/Count';
import { DataTable } from '@/components/content/DataTable';
import { EmptyState } from '@/components/content/EmptyState';
import { FactLine, FactLines } from '@/components/content/FactLine';
import InfoBanner from '@/components/content/InfoBanner.astro';
import InfoCard from '@/components/content/InfoCard.astro';
import Note from '@/components/content/Note.astro';
import { Notice } from '@/components/content/Notice';
import Timeline from '@/components/content/Timeline.astro';
import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { Combobox } from '@/components/controls/Combobox';
import { Dialog } from '@/components/controls/Dialog';
import { FilterBar } from '@/components/controls/FilterBar';
import { NumberField } from '@/components/controls/NumberField';
import { Pagination } from '@/components/controls/Pagination';
import { RadioGroup } from '@/components/controls/RadioGroup';
import { RangeField } from '@/components/controls/RangeField';
import { Select } from '@/components/controls/Select';
import { SortSelect } from '@/components/controls/SortSelect';
import { Textarea } from '@/components/controls/Textarea';
import { TextField } from '@/components/controls/TextField';
import { TextLink } from '@/components/controls/TextLink';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { ViewToggle } from '@/components/controls/ViewToggle';
import type { SpriteProps } from '@/components/game/Sprite';
import { IndexLinks } from '@/components/home/IndexLinks';
import type { TipData } from '@/lib/game/tips';

// C7-02 (spec 7.14, 14.2): the markup of every control and content component of 7.2.2 and
// 7.2.3 carries the `ac-*` classes of the design system's reference, `components/bundle.js`,
// so the stylesheets ported from `bundle.css` apply unchanged (C-R2). A class that drifts,
// goes missing or lands on another element fails here, under the name of its component.
//
// How the comparison works. Each case renders the site component with some props and reduces
// the markup to its fingerprint: one line per element that carries an `ac-*` class (or
// `sr-only`), `tag.class.class` with the classes sorted, indented by how many such elements
// contain it. Elements without a tracked class are left out, so a wrapper the site adds with no
// class, or a text node, never counts; a class on the wrong element or at the wrong depth does.
//
// The reference side is frozen in REFERENCE below, because the design system lives outside the
// repository. It is the fingerprint of the reference `bundle.js` rendered with the same props
// (a sprite as `AC.Sprite`, a tooltip as the `GameTooltipProps` the DS takes), with two
// translations that the spec fixes: `.ac-sr` is written `sr-only` (3.7), and the reference side
// of each C-R2 exception is already the element the site draws instead:
//   - Sprite: the reference sheet window `span.ac-sprite--sheet` is one `img.ac-sprite`;
//   - NestedEntity: the hidden `span.ac-nested-entity__pop` inside the wrapper is the popover
//     panel, written `(tooltip)`; the site's panel only earns that token when it is the
//     `role="tooltip"` sibling of its trigger with `popover="manual"` and the `id` that the
//     trigger's `aria-describedby` names;
//   - Select: the reference listbox only exists open, so the reference was rendered open; the
//     site's must be in the DOM while closed, as `popover="manual"`.
// The other exceptions of the table (Sidebar groups, GameTooltip sections, MobileMenu, the
// language and theme of Header, PlusN) belong to components outside 7.2.2 and 7.2.3.
//
// The five native pieces of 7.2.8, IndexLinks and the link tab have no reference: their own
// classes must belong to their block and be defined in its stylesheet, and the pieces of the
// design system they reuse (the TextField of Combobox, the tab shape of the link tab) must
// match the reference.

// ---------------------------------------------------------------------------------------------
// Reading the markup

interface Node {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style']);
const TAG_PATTERN =
  /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
const ATTRIBUTE_PATTERN = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** The element tree of server markup (React or Astro), which is always well formed. */
function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [] };
  const stack: Node[] = [root];
  const tags = new RegExp(TAG_PATTERN.source, 'gi');
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    const [, closing, rawTag, rawAttributes = '', selfClosing] = match;
    if (rawTag === undefined) continue;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const at = stack.map((node) => node.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    const attributes = new RegExp(ATTRIBUTE_PATTERN.source, 'g');
    for (let a = attributes.exec(rawAttributes); a !== null; a = attributes.exec(rawAttributes)) {
      attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    }
    const node: Node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (RAW_TEXT_TAGS.has(tag)) {
      const end = html.indexOf(`</${tag}`, tags.lastIndex);
      tags.lastIndex = end < 0 ? html.length : end;
    } else if (!selfClosing && !VOID_TAGS.has(tag)) {
      stack.push(node);
    }
  }
  return root;
}

function* descendants(node: Node): Generator<Node> {
  for (const child of node.children) {
    yield child;
    yield* descendants(child);
  }
}

function classesOf(node: Node): string[] {
  return (node.attrs.class ?? '').split(/\s+/).filter(Boolean);
}

/** The classes the comparison follows: every `ac-*` one and `sr-only`, the port of `.ac-sr`. */
function tracked(node: Node): string[] {
  const list = classesOf(node).filter((name) => name.startsWith('ac-') || name === 'sr-only');
  return [...new Set(list)].sort();
}

/**
 * The element a component renders. React 19 puts the `<link rel="preload">` of each image
 * before it in server markup; that hint is not part of the component.
 */
function top(root: Node): Node | undefined {
  return root.children.find((node) => node.tag !== 'link');
}

/** The first element, in document order, that carries `name` among its classes. */
function byClass(root: Node, name: string): Node | undefined {
  for (const node of descendants(root)) if (classesOf(node).includes(name)) return node;
  return undefined;
}

/**
 * C-R2, NestedEntity: the panel of the site stands for the reference's hidden panel only when
 * it is a manual popover with an `id` that a sibling trigger names in `aria-describedby`.
 */
function panelToken(panel: Node, parent: Node): string {
  const id = panel.attrs.id;
  const named = parent.children.some(
    (sibling) => sibling !== panel && id !== undefined && sibling.attrs['aria-describedby'] === id,
  );
  return panel.attrs.popover === 'manual' && named
    ? '(tooltip)'
    : '(tooltip that is not a manual popover named by its trigger)';
}

/** One line per element with tracked classes, indented by the tracked elements around it. */
function fingerprintOf(root: Node): string {
  const lines: string[] = [];
  const walk = (node: Node, depth: number, parent: Node) => {
    const indent = '  '.repeat(depth);
    if (node.attrs.role === 'tooltip') {
      lines.push(indent + panelToken(node, parent));
      return;
    }
    // C-R2, Select: the site keeps the check in the DOM exactly once, parked in the first
    // option while nothing is chosen; select.css shows it only when aria-selected is true.
    if (classesOf(node).includes('ac-select__check') && parent.attrs['aria-selected'] === 'false') {
      return;
    }
    const classes = tracked(node);
    let inner = depth;
    if (classes.length > 0) {
      let line = `${indent}${node.tag}.${classes.join('.')}`;
      // C-R2, Select: a listbox is always in the DOM, as a manual popover.
      if (node.attrs.role === 'listbox' && node.attrs.popover !== 'manual') {
        line += ' (listbox that is not a manual popover)';
      }
      lines.push(line);
      inner = depth + 1;
    }
    for (const child of node.children) walk(child, inner, node);
  };
  for (const child of root.children) walk(child, 0, root);
  return lines.join('\n');
}

function fingerprint(html: string): string {
  return fingerprintOf(parse(html));
}

/** The same fingerprint without tags, for the link tab: its items are links, not buttons. */
function tagless(print: string): string {
  return print.replace(/^( *)[a-z0-9]+\./gm, '$1.');
}

/** A fingerprint written in the table, without the indentation of the source. */
function fp(strings: TemplateStringsArray): string {
  const lines = strings.raw
    .join('')
    .split('\n')
    .filter((line) => line.trim() !== '');
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent).trimEnd()).join('\n');
}

// ---------------------------------------------------------------------------------------------
// Rendering

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

type AstroComponent = Parameters<AstroContainer['renderToString']>[0];

function astro(component: AstroComponent, props: Record<string, unknown>, slot?: string) {
  return () =>
    container.renderToString(component, {
      props,
      slots: slot === undefined ? undefined : { default: slot },
    });
}

function tsx(element: ReactElement) {
  return () => renderToStaticMarkup(element);
}

// ---------------------------------------------------------------------------------------------
// Cases: the site side of every row of REFERENCE, with the same props

const sprite: SpriteProps = { src: '/sprites/prueba.png', size: [32, 32] };
const sprite16: SpriteProps = { src: '/sprites/prueba-16.png', size: [16, 16] };
/** A `variante` sheet: the reference draws it as a window over the strip (C-R2). */
const sheet: SpriteProps = {
  src: '/sprites/hoja.png',
  size: [32, 32],
  frames: 4,
  mode: 'variante',
  frame: 2,
};
const tip: TipData = {
  key: 'item:prueba',
  title: 'Prueba',
  width: 240,
  head: { type: 'sprite', sprite: null },
  rows: [{ label: 'Uso', value: 'Prueba' }],
};
const tipText = { locale: 'es', hint: 'Mantén Shift para fijar' } as const;
const options = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
  { value: 'c', label: 'Tres' },
];
const views = { cards: 'Cards', slots: 'Slots', list: 'Lista' };
const pages = { prev: 'Anterior', next: 'Siguiente', page: 'Página' };
const hrefFor = (n: number) => `/es/lista/?pagina=${n}`;

type Render = () => string | Promise<string>;

const CASES: Record<string, Record<string, Render>> = {
  Button: {
    default: tsx(<Button>Importar</Button>),
    solid: tsx(<Button variant="solid">Copiar</Button>),
    icon: tsx(<Button variant="icon" icon="menu" ariaLabel="Menú" />),
    'icon and text': tsx(<Button icon="arrow-right">Ver</Button>),
    pressed: tsx(<Button pressed>Por semana</Button>),
    touch: tsx(<Button touch>Importar</Button>),
    link: tsx(<Button href="/es/exportar.csv">Exportar</Button>),
    'disabled link': tsx(
      <Button href="/es/exportar.csv" disabled>
        Exportar
      </Button>,
    ),
  },
  TextLink: {
    entity: tsx(<TextLink href="/es/pokedex/">Pokédex</TextLink>),
    prose: tsx(
      <TextLink href="/es/pokedex/" variant="prose">
        Pokédex
      </TextLink>,
    ),
  },
  TextField: {
    default: tsx(<TextField label="Nombre" helper="Ayuda" placeholder="Ejemplo" />),
    'hidden label': tsx(<TextField label="Nombre" labelHidden />),
    search: tsx(<TextField variant="search" label="Buscar" />),
    filter: tsx(<TextField variant="filter" label="Buscar" />),
  },
  NumberField: {
    default: tsx(
      <NumberField
        label="Boost"
        helper="Ayuda"
        min={0}
        max={50}
        defaultValue={10}
        decrementLabel="Disminuir"
        incrementLabel="Aumentar"
      />,
    ),
  },
  RangeField: {
    default: tsx(
      <RangeField legend="Precio" placeholders={['Mín', 'Máx']} labels={['Mínimo', 'Máximo']} />,
    ),
  },
  Select: {
    chosen: tsx(<Select label="Tier" options={options} value="b" />),
    placeholder: tsx(<Select label="Tier" options={options} placeholder="Todas" />),
    'inline compact': tsx(<Select label="Tier" options={options} value="a" inline compact />),
    'hidden label': tsx(<Select label="Tier" options={options} value="a" labelHidden />),
  },
  SortSelect: {
    default: tsx(<SortSelect label="Ordenar por" options={options} value="c" />),
  },
  ToggleGroup: {
    text: tsx(<ToggleGroup label="Grupo" options={options} value="b" />),
    'visible label': tsx(<ToggleGroup label="Grupo" labelHidden={false} options={options} />),
    'strong label': tsx(<ToggleGroup label="Grupo" labelHidden={false} strong options={options} />),
    sprite: tsx(
      <ToggleGroup
        label="Grupo"
        variant="sprite"
        options={[
          { value: 'a', label: 'Uno', sprite },
          { value: 'b', label: 'Dos', sprite: sheet },
          { value: 'c', label: 'Tres', sprite: 'shiny' },
        ]}
      />,
    ),
    tab: tsx(
      <ToggleGroup
        label="Grupo"
        variant="tab"
        options={[
          { value: 'a', label: 'Uno', sprite },
          { value: 'b', label: 'Dos' },
        ]}
      />,
    ),
    column: tsx(<ToggleGroup label="Grupo" direction="column" options={options} />),
    grid: tsx(<ToggleGroup label="Grupo" direction="grid" columns={3} options={options} />),
  },
  ViewToggle: {
    default: tsx(<ViewToggle labels={views} ariaLabel="Vista" />),
    list: tsx(<ViewToggle labels={views} ariaLabel="Vista" value="list" />),
  },
  Pagination: {
    first: tsx(
      <Pagination
        page={1}
        pageCount={10}
        hrefFor={hrefFor}
        labels={pages}
        ariaLabel="Paginación"
      />,
    ),
    middle: tsx(
      <Pagination
        page={5}
        pageCount={10}
        hrefFor={hrefFor}
        labels={pages}
        ariaLabel="Paginación"
      />,
    ),
    last: tsx(
      <Pagination
        page={10}
        pageCount={10}
        hrefFor={hrefFor}
        labels={pages}
        ariaLabel="Paginación"
      />,
    ),
    'summary centred': tsx(
      <Pagination
        page={2}
        pageCount={3}
        hrefFor={hrefFor}
        labels={pages}
        ariaLabel="Paginación"
        summary="1 a 10 de 25"
        align="center"
      />,
    ),
  },
  FilterBar: {
    grid: tsx(
      <FilterBar columns={3}>
        <Count>6</Count>
      </FilterBar>,
    ),
    fill: tsx(
      <FilterBar layout="fill">
        <Count>6</Count>
      </FilterBar>,
    ),
  },
  Chip: {
    fact: tsx(<Chip>45 minutos</Chip>),
    sprite: tsx(<Chip sprite={sprite16}>Prueba</Chip>),
    sheet: tsx(<Chip sprite={sheet}>Prueba</Chip>),
    shiny: tsx(<Chip shiny>Shiny</Chip>),
    link: tsx(<Chip href="/es/items/">T1</Chip>),
    'entity text': tsx(
      <Chip tip={tip} href="/es/items/prueba/" {...tipText}>
        Prueba
      </Chip>,
    ),
    'entity sprite': tsx(
      <Chip tip={tip} href="/es/items/prueba/" sprite={sprite16} {...tipText}>
        Prueba
      </Chip>,
    ),
    'entity shiny': tsx(
      <Chip tip={tip} href="/es/items/prueba/" shiny {...tipText}>
        Shiny
      </Chip>,
    ),
  },
  Count: {
    live: tsx(<Count>6 anuncios</Count>),
    still: tsx(<Count live={false}>6 anuncios</Count>),
  },
  Note: {
    lead: astro(Note, { lead: 'Observación:' }, 'Texto.'),
    'no lead': astro(Note, { lead: null }, 'Texto.'),
  },
  InfoBanner: {
    sprite: astro(InfoBanner, { sprite, facts: ['Uno', 'Dos', 'Tres'] }),
    'no sprite': astro(InfoBanner, { facts: ['Uno'] }),
    missing: astro(InfoBanner, { sprite: null, facts: ['Uno', 'Dos'] }),
  },
  Notice: {
    default: tsx(<Notice closeLabel="Cerrar aviso">Hecho.</Notice>),
  },
  EmptyState: {
    line: tsx(<EmptyState>Sin resultados.</EmptyState>),
    action: tsx(<EmptyState action={<Button>Importar</Button>}>Sin datos.</EmptyState>),
  },
  DataTable: {
    basic: tsx(
      <DataTable
        caption="Tabla"
        columns={[
          { key: 'a', label: 'A', align: 'left' },
          { key: 'b', label: 'B', numeric: true, align: 'right', width: 120 },
          { key: 'c', label: 'C' },
        ]}
        rows={[
          { key: 1, cells: { a: 'Uno', b: 1, c: 'x' } },
          { key: 2, cells: { a: 'Dos', b: null, c: 'y' } },
        ]}
      />,
    ),
    rich: tsx(
      <DataTable
        caption="Tabla"
        rowHeight={48}
        hover
        wrap
        dense
        labels={{ inactive: 'Inactivo' }}
        columns={[
          { key: 's', label: 'Sprite', srOnly: true },
          { key: 'a', label: 'A', rowHeader: true, nowrap: true },
          { key: 'b', label: 'B', text: 'ui', headAlign: 'right' },
          { key: 'c', label: 'C', text: 'ui-loose', badge: true },
          { key: 'd', label: 'D' },
        ]}
        rows={[
          {
            key: 1,
            cells: { s: '', a: 'Uno', b: { value: 'x', sub: 'sub' }, c: 'z', d: 'w' },
            current: true,
          },
          { key: 2, cells: { s: '', a: 'Dos', b: 'y', c: 'z', d: 'w' }, tone: 'inactive' },
        ]}
      />,
    ),
    sortable: tsx(
      <DataTable
        caption="Tabla"
        sort={{ key: 'a', dir: 'descending' }}
        columns={[
          { key: 'a', label: 'A', sortable: true },
          { key: 'b', label: 'B', sortable: true },
          { key: 'c', label: 'C' },
        ]}
        rows={[{ key: 1, cells: { a: 'Uno', b: 2, c: 'x' } }]}
      />,
    ),
    scroll: tsx(
      <DataTable
        caption="Tabla"
        scroll
        columns={[{ key: 'a', label: 'A' }]}
        rows={[{ key: 1, cells: { a: 'Uno' } }]}
      />,
    ),
  },
  Timeline: {
    // The points of the second step (7.2.8) are a plain `ul`, so they leave no line.
    default: astro(Timeline, {
      steps: [
        {
          sprite,
          label: 'Paso 1:',
          text: 'Texto.',
          chips: [{ children: '45 minutos' }, { children: 'Prueba', sprite: sprite16 }],
        },
        { sprite: null, text: 'Texto.', points: ['Punto'] },
        { label: 'Paso 3:' },
      ],
    }),
  },
  FactLine: {
    single: tsx(<FactLine label="Mundo">Alliance</FactLine>),
    values: tsx(<FactLine label="Mundo" values={['Uno', 'Dos', 'Tres']} />),
    entity: tsx(
      <FactLine
        label="Drop de"
        values={[{ text: 'Prueba', tip, href: '/es/pokedex/prueba/' }]}
        {...tipText}
      />,
    ),
    'entity label': tsx(
      <FactLine
        label={['Hunts de ', { text: 'Prueba', tip, href: '/es/pokedex/prueba/' }]}
        values={['Uno']}
        {...tipText}
      />,
    ),
    'lines row': tsx(
      <FactLines>
        <FactLine label="Uno">A</FactLine>
        <FactLine label="Dos" values={['B', 'C']} />
      </FactLines>,
    ),
    'lines column': tsx(
      <FactLines
        layout="column"
        lines={[
          { label: 'Uno', values: ['A'] },
          { label: 'Dos', values: ['B', 'C'] },
        ]}
      />,
    ),
  },
  InfoCard: {
    sprite: astro(InfoCard, { title: 'Título', sprite }, 'Texto.'),
    'no sprite': astro(InfoCard, { title: 'Título' }, 'Texto.'),
    heading: astro(InfoCard, { title: 'Título', sprite, level: 3 }, 'Texto.'),
    missing: astro(InfoCard, { title: 'Título', sprite: null }, 'Texto.'),
  },
};

// ---------------------------------------------------------------------------------------------
// The reference, frozen: `bundle.js` rendered with the props of each case (see the head of the
// file). Regenerate it only from the design system's own bundle, never from the site's output.

const REFERENCE: Record<string, Record<string, string>> = {
  Button: {
    default: fp`button.ac-button`,
    solid: fp`button.ac-button.ac-button--solid`,
    icon: fp`
      button.ac-button.ac-button--icon
        span.ac-button__icon
    `,
    'icon and text': fp`
      button.ac-button
        span.ac-button__icon
    `,
    pressed: fp`button.ac-button`,
    touch: fp`button.ac-button.ac-button--touch`,
    link: fp`a.ac-button`,
    'disabled link': fp`button.ac-button`,
  },
  TextLink: {
    entity: fp`a.ac-text-link`,
    prose: fp`a.ac-text-link.ac-text-link--prose`,
  },
  TextField: {
    default: fp`
      div.ac-text-field
        label.ac-text-field__label
        input.ac-text-field__input
        p.ac-text-field__helper
    `,
    'hidden label': fp`
      div.ac-text-field
        label.sr-only
        input.ac-text-field__input
    `,
    search: fp`
      div.ac-text-field.ac-text-field--search
        label.sr-only
        div.ac-text-field__control
          svg.ac-text-field__icon
          input.ac-text-field__input
    `,
    filter: fp`
      div.ac-text-field.ac-text-field--filter
        label.sr-only
        div.ac-text-field__control
          svg.ac-text-field__icon
          input.ac-text-field__input
    `,
  },
  NumberField: {
    default: fp`
      div.ac-number-field
        label.ac-number-field__label
        div.ac-number-field__group
          input.ac-number-field__input
          button.ac-number-field__step
          button.ac-number-field__step
        p.ac-number-field__helper
    `,
  },
  RangeField: {
    default: fp`
      fieldset.ac-range-field
        legend.ac-range-field__legend
        div.ac-range-field__row
          label.sr-only
          input.ac-range-field__input
          span.ac-range-field__dash
          label.sr-only
          input.ac-range-field__input
    `,
  },
  Select: {
    chosen: fp`
      div.ac-select
        p.ac-select__label
        div.ac-select__control
          button.ac-select__trigger
            span.ac-select__value
            svg.ac-select__chevron
          ul.ac-select__listbox
            li.ac-select__option
            li.ac-select__option
              svg.ac-select__check
            li.ac-select__option
    `,
    placeholder: fp`
      div.ac-select
        p.ac-select__label
        div.ac-select__control
          button.ac-select__trigger
            span.ac-select__value.ac-select__value--placeholder
            svg.ac-select__chevron
          ul.ac-select__listbox
            li.ac-select__option
            li.ac-select__option
            li.ac-select__option
    `,
    'inline compact': fp`
      div.ac-select.ac-select--compact.ac-select--inline
        p.ac-select__label
        div.ac-select__control
          button.ac-select__trigger
            span.ac-select__value
            svg.ac-select__chevron
          ul.ac-select__listbox
            li.ac-select__option
              svg.ac-select__check
            li.ac-select__option
            li.ac-select__option
    `,
    'hidden label': fp`
      div.ac-select
        p.sr-only
        div.ac-select__control
          button.ac-select__trigger
            span.ac-select__value
            svg.ac-select__chevron
          ul.ac-select__listbox
            li.ac-select__option
              svg.ac-select__check
            li.ac-select__option
            li.ac-select__option
    `,
  },
  SortSelect: {
    default: fp`
      div.ac-select.ac-select--compact.ac-select--inline.ac-sort-select
        p.ac-select__label
        div.ac-select__control
          button.ac-select__trigger
            span.ac-select__value
            svg.ac-select__chevron
          ul.ac-select__listbox
            li.ac-select__option
            li.ac-select__option
            li.ac-select__option
              svg.ac-select__check
    `,
  },
  ToggleGroup: {
    text: fp`
      div.ac-toggle-group.ac-toggle-group--text
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
    'visible label': fp`
      div.ac-toggle-group.ac-toggle-group--text
        p.ac-toggle-group__label
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
    'strong label': fp`
      div.ac-toggle-group.ac-toggle-group--text
        p.ac-toggle-group__label.ac-toggle-group__label--strong
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
    sprite: fp`
      div.ac-toggle-group.ac-toggle-group--sprite
        div.ac-toggle-group__items
          button.ac-toggle-group__item
            img.ac-sprite
            span.ac-toggle-group__text
          button.ac-toggle-group__item
            img.ac-sprite
            span.ac-toggle-group__text
          button.ac-toggle-group__item
            span.ac-shiny-mark.ac-shiny-mark--sprite
              img.ac-shiny-mark__icon
            span.ac-toggle-group__text
    `,
    tab: fp`
      div.ac-toggle-group.ac-toggle-group--tab
        div.ac-toggle-group__items
          button.ac-toggle-group__item
            img.ac-sprite
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
    column: fp`
      div.ac-toggle-group.ac-toggle-group--column.ac-toggle-group--text
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
    grid: fp`
      div.ac-toggle-group.ac-toggle-group--grid.ac-toggle-group--text
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
  },
  ViewToggle: {
    default: fp`
      div.ac-toggle-group.ac-toggle-group--text.ac-view-toggle
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
    list: fp`
      div.ac-toggle-group.ac-toggle-group--text.ac-view-toggle
        div.ac-toggle-group__items
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
          button.ac-toggle-group__item.ac-toggle-group__item--text
            span.ac-toggle-group__text
    `,
  },
  Pagination: {
    first: fp`
      div.ac-pagination
        nav.ac-pagination__nav
          ul.ac-pagination__list
            button.ac-pagination__step
            a.ac-pagination__page
            a.ac-pagination__page
            a.ac-pagination__page
            li.ac-pagination__gap
            a.ac-pagination__page
            a.ac-pagination__step
    `,
    middle: fp`
      div.ac-pagination
        nav.ac-pagination__nav
          ul.ac-pagination__list
            a.ac-pagination__step
            a.ac-pagination__page
            li.ac-pagination__gap
            a.ac-pagination__page
            a.ac-pagination__page
            a.ac-pagination__page
            li.ac-pagination__gap
            a.ac-pagination__page
            a.ac-pagination__step
    `,
    last: fp`
      div.ac-pagination
        nav.ac-pagination__nav
          ul.ac-pagination__list
            a.ac-pagination__step
            a.ac-pagination__page
            li.ac-pagination__gap
            a.ac-pagination__page
            a.ac-pagination__page
            a.ac-pagination__page
            button.ac-pagination__step
    `,
    'summary centred': fp`
      div.ac-pagination.ac-pagination--center.ac-pagination--summary
        p.ac-pagination__summary
        nav.ac-pagination__nav
          ul.ac-pagination__list
            a.ac-pagination__step
            a.ac-pagination__page
            a.ac-pagination__page
            a.ac-pagination__page
            a.ac-pagination__step
    `,
  },
  FilterBar: {
    grid: fp`
      div.ac-filter-bar
        p.ac-count
    `,
    fill: fp`
      div.ac-filter-bar.ac-filter-bar--fill
        p.ac-count
    `,
  },
  Chip: {
    fact: fp`span.ac-chip`,
    sprite: fp`
      span.ac-chip.ac-chip--sprite
        span.ac-chip__sprite
          img.ac-sprite
    `,
    sheet: fp`
      span.ac-chip.ac-chip--sprite
        span.ac-chip__sprite
          img.ac-sprite
    `,
    shiny: fp`
      span.ac-chip.ac-chip--shiny.ac-chip--sprite
        span.ac-shiny-mark.ac-shiny-mark--sprite
          img.ac-shiny-mark__icon
    `,
    link: fp`a.ac-chip.ac-chip--link`,
    'entity text': fp`
      span.ac-nested-entity
        a.ac-nested-entity__trigger.ac-nested-entity__trigger--chip-text
        (tooltip)
    `,
    'entity sprite': fp`
      span.ac-nested-entity
        a.ac-nested-entity__trigger.ac-nested-entity__trigger--chip
          span.ac-chip__sprite
            img.ac-sprite
        (tooltip)
    `,
    'entity shiny': fp`
      span.ac-nested-entity
        a.ac-chip--shiny.ac-nested-entity__trigger.ac-nested-entity__trigger--chip
          span.ac-shiny-mark.ac-shiny-mark--sprite
            img.ac-shiny-mark__icon
        (tooltip)
    `,
  },
  Count: {
    live: fp`p.ac-count`,
    still: fp`p.ac-count`,
  },
  Note: {
    lead: fp`
      p.ac-note
        strong.ac-note__lead
    `,
    'no lead': fp`p.ac-note`,
  },
  InfoBanner: {
    sprite: fp`
      div.ac-info-banner
        span.ac-info-banner__sprite
          img.ac-sprite
        div.ac-info-banner__facts
          p.ac-info-banner__fact
          span.ac-info-banner__sep
          p.ac-info-banner__fact
          span.ac-info-banner__sep
          p.ac-info-banner__fact
    `,
    'no sprite': fp`
      div.ac-info-banner
        div.ac-info-banner__facts
          p.ac-info-banner__fact
    `,
    missing: fp`
      div.ac-info-banner
        span.ac-info-banner__sprite
          span.ac-missing-sprite.ac-missing-sprite--16
        div.ac-info-banner__facts
          p.ac-info-banner__fact
          span.ac-info-banner__sep
          p.ac-info-banner__fact
    `,
  },
  Notice: {
    default: fp`
      div.ac-notice
        p.ac-notice__text
        button.ac-notice__close
    `,
  },
  EmptyState: {
    line: fp`p.ac-empty-state`,
    action: fp`
      div.ac-empty-state.ac-empty-state--action
        p.ac-empty-state__text
        div.ac-empty-state__action
          button.ac-button
    `,
  },
  DataTable: {
    basic: fp`
      div.ac-data-table
        table.ac-data-table__table
          caption.sr-only
          tr.ac-data-table__head
            th.ac-data-table__th.ac-data-table__th--left
            th.ac-data-table__th.ac-data-table__th--right
            th.ac-data-table__th
          tr.ac-data-table__row
            td.ac-data-table__cell.ac-data-table__cell--left
            td.ac-data-table__cell.ac-data-table__cell--num.ac-data-table__cell--right
            td.ac-data-table__cell
          tr.ac-data-table__row
            td.ac-data-table__cell.ac-data-table__cell--left
            td.ac-data-table__cell.ac-data-table__cell--num.ac-data-table__cell--right
            td.ac-data-table__cell
    `,
    rich: fp`
      div.ac-data-table.ac-data-table--dense.ac-data-table--hover.ac-data-table--rows-48.ac-data-table--wrap
        table.ac-data-table__table
          caption.sr-only
          tr.ac-data-table__head
            th.ac-data-table__th
              span.sr-only
            th.ac-data-table__th
            th.ac-data-table__th.ac-data-table__th--right
            th.ac-data-table__th
            th.ac-data-table__th
          tr.ac-data-table__row.ac-data-table__row--current.ac-data-table__row--tall
            td.ac-data-table__cell
            th.ac-data-table__cell.ac-data-table__cell--nowrap
            td.ac-data-table__cell.ac-data-table__cell--ui
              span.ac-data-table__sub
            td.ac-data-table__cell.ac-data-table__cell--ui-loose
            td.ac-data-table__cell
          tr.ac-data-table__row.ac-data-table__row--inactive
            td.ac-data-table__cell
            th.ac-data-table__cell.ac-data-table__cell--nowrap
            td.ac-data-table__cell.ac-data-table__cell--ui
            td.ac-data-table__cell.ac-data-table__cell--ui-loose
              span.ac-data-table__stack
                span.ac-data-table__badge
            td.ac-data-table__cell
    `,
    sortable: fp`
      div.ac-data-table.ac-data-table--sortable
        table.ac-data-table__table
          caption.sr-only
          tr.ac-data-table__head
            th.ac-data-table__th
              button.ac-data-table__sort
            th.ac-data-table__th
              button.ac-data-table__sort
                svg.ac-data-table__sort-idle
            th.ac-data-table__th
          tr.ac-data-table__row
            td.ac-data-table__cell
            td.ac-data-table__cell
            td.ac-data-table__cell
    `,
    scroll: fp`
      div.ac-data-table.ac-data-table--scroll
        table.ac-data-table__table
          caption.sr-only
          tr.ac-data-table__head
            th.ac-data-table__th
          tr.ac-data-table__row
            td.ac-data-table__cell
    `,
  },
  Timeline: {
    default: fp`
      ol.ac-timeline
        li.ac-timeline__step
          div.ac-timeline__rail
            div.ac-timeline__line
            div.ac-timeline__node
              img.ac-sprite
          div.ac-timeline__body
            p.ac-timeline__label
            p.ac-timeline__text
            ul.ac-timeline__chips
              li.ac-timeline__chip
                span.ac-chip
              li.ac-timeline__chip
                span.ac-chip.ac-chip--sprite
                  span.ac-chip__sprite
                    img.ac-sprite
        li.ac-timeline__step
          div.ac-timeline__rail
            div.ac-timeline__line
            div.ac-timeline__node
              span.ac-missing-sprite.ac-missing-sprite--16
          div.ac-timeline__body
            p.ac-timeline__text
        li.ac-timeline__step.ac-timeline__step--last
          div.ac-timeline__rail
            div.ac-timeline__node
          div.ac-timeline__body
            p.ac-timeline__label
    `,
  },
  FactLine: {
    single: fp`
      p.ac-fact-line
        span.ac-fact-line__label
        span.ac-fact-line__value
    `,
    values: fp`
      p.ac-fact-line
        span.ac-fact-line__label
        span.ac-fact-line__value
          span.ac-fact-line__sep
          span.ac-fact-line__sep
    `,
    entity: fp`
      p.ac-fact-line
        span.ac-fact-line__label
        span.ac-fact-line__value
          span.ac-nested-entity
            a.ac-nested-entity__trigger.ac-nested-entity__trigger--link
            (tooltip)
    `,
    'entity label': fp`
      p.ac-fact-line
        span.ac-fact-line__label
          span.ac-nested-entity
            a.ac-nested-entity__trigger.ac-nested-entity__trigger--link
            (tooltip)
        span.ac-fact-line__value
    `,
    'lines row': fp`
      dl.ac-fact-lines.ac-fact-lines--row
        div.ac-fact-line
          dt.ac-fact-line__label
          dd.ac-fact-line__value
        div.ac-fact-line
          dt.ac-fact-line__label
          dd.ac-fact-line__value
            span.ac-fact-line__sep
    `,
    'lines column': fp`
      dl.ac-fact-lines.ac-fact-lines--column
        div.ac-fact-line
          dt.ac-fact-line__label
          dd.ac-fact-line__value
        div.ac-fact-line
          dt.ac-fact-line__label
          dd.ac-fact-line__value
            span.ac-fact-line__sep
    `,
  },
  InfoCard: {
    sprite: fp`
      div.ac-info-card
        div.ac-info-card__head
          span.ac-info-card__sprite
            img.ac-sprite
          p.ac-info-card__title
          span.ac-info-card__sprite
            img.ac-sprite
        p.ac-info-card__body
    `,
    'no sprite': fp`
      div.ac-info-card
        div.ac-info-card__head
          p.ac-info-card__title
        p.ac-info-card__body
    `,
    heading: fp`
      div.ac-info-card
        div.ac-info-card__head
          span.ac-info-card__sprite
            img.ac-sprite
          h3.ac-info-card__title
          span.ac-info-card__sprite
            img.ac-sprite
        p.ac-info-card__body
    `,
    missing: fp`
      div.ac-info-card
        div.ac-info-card__head
          span.ac-info-card__sprite
            span.ac-missing-sprite.ac-missing-sprite--16
          p.ac-info-card__title
          span.ac-info-card__sprite
            span.ac-missing-sprite.ac-missing-sprite--16
        p.ac-info-card__body
    `,
  },
};

// ---------------------------------------------------------------------------------------------
// C7-02 for the 21 components of 7.2.2 and 7.2.3

/** Spec 7.2.2 (11 controls) and 7.2.3 (10 content components). */
const COMPONENTS = [
  'Button',
  'TextLink',
  'TextField',
  'NumberField',
  'RangeField',
  'Select',
  'SortSelect',
  'ToggleGroup',
  'ViewToggle',
  'Pagination',
  'FilterBar',
  'Chip',
  'Count',
  'Note',
  'InfoBanner',
  'Notice',
  'EmptyState',
  'DataTable',
  'Timeline',
  'FactLine',
  'InfoCard',
];

describe('the comparison', () => {
  it('covers every component of 7.2.2 and 7.2.3, each with every case of its reference', () => {
    expect(Object.keys(CASES)).toEqual(COMPONENTS);
    expect(Object.keys(REFERENCE)).toEqual(COMPONENTS);
    for (const component of COMPONENTS) {
      expect(Object.keys(CASES[component]), component).toEqual(Object.keys(REFERENCE[component]));
    }
  });

  it('tells a class on the wrong element from the right one', () => {
    expect(fingerprint('<div class="ac-a x"><p><span class="ac-b"></span></p></div>')).toBe(
      'div.ac-a\n  span.ac-b',
    );
    expect(fingerprint('<div class="ac-a"></div><span class="ac-b"></span>')).toBe(
      'div.ac-a\nspan.ac-b',
    );
  });
});

for (const component of COMPONENTS) {
  describe(component, () => {
    for (const [name, render] of Object.entries(CASES[component])) {
      it(`${name}: has the ac-* classes of the reference`, async () => {
        expect(fingerprint(await render()), `${component} (${name})`).toBe(
          REFERENCE[component][name],
        );
      });
    }
  });
}

// ---------------------------------------------------------------------------------------------
// C-R2: what the site draws in place of an element the exception table changes

describe('C-R2 exceptions', () => {
  it('Sprite: a sheet is one <img class="ac-sprite">, never the window of the reference', async () => {
    const root = parse(await CASES.Chip.sheet());
    const sprites = [...descendants(root)].filter((node) =>
      classesOf(node).some((name) => name.startsWith('ac-sprite')),
    );

    expect(sprites.map((node) => `${node.tag}.${classesOf(node).join('.')}`)).toEqual([
      'img.ac-sprite',
    ]);
  });

  it('NestedEntity: the panel is the manual popover next to its trigger, named by it', async () => {
    const root = parse(await CASES.Chip['entity text']());
    const wrapper = byClass(root, 'ac-nested-entity');
    const [trigger, panel] = wrapper?.children ?? [];

    expect(trigger?.attrs['aria-describedby']).toBeTruthy();
    expect(panel?.attrs).toMatchObject({
      role: 'tooltip',
      popover: 'manual',
      id: trigger?.attrs['aria-describedby'],
    });
    expect(byClass(root, 'ac-nested-entity__pop')).toBeUndefined();
  });

  it('Select: the listbox is in the DOM while closed, as a manual popover', async () => {
    const root = parse(await CASES.Select.chosen());
    const trigger = byClass(root, 'ac-select__trigger');
    const listbox = byClass(root, 'ac-select__listbox');

    expect(trigger?.attrs['aria-expanded']).toBe('false');
    expect(listbox?.attrs).toMatchObject({ role: 'listbox', popover: 'manual' });
  });
});

// ---------------------------------------------------------------------------------------------
// The pieces of 7.2.8, which the design system does not have

const STYLES = fileURLToPath(new URL('../../src/styles/components/', import.meta.url));

function stylesheet(block: string): string {
  return readFileSync(`${STYLES}${block.slice('ac-'.length)}.css`, 'utf8');
}

function defines(css: string, name: string): boolean {
  return new RegExp(`\\.${name}(?![\\w-])`).test(css);
}

/** `ac-block`, its elements `ac-block__x` and its modifiers `ac-block--y` (3.7). */
function inBlock(block: string, name: string): boolean {
  return new RegExp(`^${block}(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?$`).test(name);
}

interface Piece {
  /** Its block: the root class, and the stylesheet `src/styles/components/<block>.css`. */
  block: string;
  /** The element 7.2.8 builds it on. */
  root: string;
  /** Blocks of the design system it composes, compared against the reference elsewhere. */
  borrows: string[];
  render: Render;
}

const PIECES: Record<string, Piece> = {
  Dialog: {
    block: 'ac-dialog',
    root: 'dialog',
    borrows: ['ac-button'],
    render: tsx(
      <Dialog
        open={false}
        onClose={() => undefined}
        title="Título"
        closeLabel="Cerrar"
        actions={<Button>Aceptar</Button>}
      >
        Texto.
      </Dialog>,
    ),
  },
  Combobox: {
    block: 'ac-combobox',
    root: 'div',
    borrows: ['ac-text-field'],
    render: tsx(
      <Combobox
        label="Nombre"
        helper="Ayuda"
        placeholder="Ejemplo"
        options={[
          { value: 'a', label: 'Uno', meta: 'Nº 1', media: null },
          { value: 'b', label: 'Dos', disabled: true },
        ]}
      />,
    ),
  },
  Checkbox: {
    block: 'ac-checkbox',
    root: 'div',
    borrows: [],
    render: tsx(<Checkbox label="A convenir" helper="Ayuda" />),
  },
  RadioGroup: {
    block: 'ac-radio-group',
    root: 'fieldset',
    borrows: [],
    render: tsx(<RadioGroup legend="Motivo" options={options} helper="Ayuda" />),
  },
  Textarea: {
    block: 'ac-textarea',
    root: 'div',
    borrows: [],
    render: tsx(<Textarea label="Detalle" helper="Ayuda" rows={4} />),
  },
  // A plain link and a link with its panel (8.4.1): the second one is a NestedEntity.
  IndexLinks: {
    block: 'ac-index-links',
    root: 'div',
    borrows: [
      'ac-nested-entity',
      'ac-game-tooltip',
      'ac-sprite',
      'ac-sprite-cell',
      'ac-sprite-stage',
      'ac-missing-sprite',
    ],
    render: tsx(
      <IndexLinks
        links={[
          { id: 'uno', label: 'Uno', href: '/es/sistemas/uno/', sprite },
          {
            id: 'dos',
            label: 'Dos',
            labelLang: 'en',
            href: '/es/sistemas/dos/',
            sprite: null,
            tip,
          },
        ]}
        {...tipText}
      />,
    ),
  },
};

describe('pieces of 7.2.8', () => {
  for (const [piece, { block, root: rootTag, borrows, render }] of Object.entries(PIECES)) {
    it(`${piece}: its classes belong to ${block}, and its stylesheet defines each one`, async () => {
      const root = parse(await render());
      const css = stylesheet(block);
      const strays: string[] = [];
      const undefinedClasses: string[] = [];
      for (const node of descendants(root)) {
        for (const name of tracked(node)) {
          if (inBlock(block, name)) {
            if (!defines(css, name)) undefinedClasses.push(name);
          } else if (name !== 'sr-only' && !borrows.some((other) => inBlock(other, name))) {
            strays.push(name);
          }
        }
      }

      expect(top(root)?.tag, piece).toBe(rootTag);
      expect(classesOf(top(root) ?? root), piece).toContain(block);
      expect(strays, `${piece}: classes outside its block`).toEqual([]);
      expect([...new Set(undefinedClasses)], `${piece}: classes ${block}.css lacks`).toEqual([]);
    });
  }

  it('Dialog: the server draws the closed native dialog, never <dialog open>', async () => {
    const dialog = top(parse(await PIECES.Dialog.render()));

    expect(dialog?.tag).toBe('dialog');
    expect(dialog?.attrs).not.toHaveProperty('open');
  });

  it('Combobox: its field is the TextField of the reference, its list a manual popover', async () => {
    const root = parse(await PIECES.Combobox.render());
    const field = byClass(root, 'ac-text-field');
    const input = byClass(root, 'ac-text-field__input');
    const listbox = byClass(root, 'ac-combobox__listbox');

    expect(field && fingerprintOf({ tag: '#root', attrs: {}, children: [field] })).toBe(
      REFERENCE.TextField.default,
    );
    expect(input?.attrs.role).toBe('combobox');
    expect(input?.attrs['aria-controls']).toBe(listbox?.attrs.id);
    expect(listbox?.attrs).toMatchObject({ role: 'listbox', popover: 'manual' });
  });

  it('Checkbox, RadioGroup and Textarea: the native elements of 7.2.8', async () => {
    const checkbox = parse(await PIECES.Checkbox.render());
    const radios = parse(await PIECES.RadioGroup.render());
    const textarea = parse(await PIECES.Textarea.render());

    expect(byClass(checkbox, 'ac-checkbox__row')?.tag).toBe('label');
    expect(byClass(checkbox, 'ac-checkbox__input')?.attrs.type).toBe('checkbox');
    expect(byClass(radios, 'ac-radio-group__legend')?.tag).toBe('legend');
    expect([...descendants(radios)].filter((node) => node.attrs.type === 'radio')).toHaveLength(
      options.length,
    );
    expect(byClass(textarea, 'ac-textarea__input')?.tag).toBe('textarea');
  });

  it('the link tab keeps the classes of the tab, as links in a nav', () => {
    const html = renderToStaticMarkup(
      <ToggleGroup
        label="Grupo"
        variant="tab"
        value="a"
        options={[
          { value: 'a', label: 'Uno', sprite, href: '/es/uno/' },
          { value: 'b', label: 'Dos', href: '/es/dos/' },
        ]}
      />,
    );
    const root = parse(html);
    const links = [...descendants(root)].filter((node) => node.tag === 'a');

    expect(tagless(fingerprint(html))).toBe(tagless(REFERENCE.ToggleGroup.tab));
    expect(top(root)?.tag).toBe('nav');
    expect(links.map((link) => link.attrs['aria-current'] ?? null)).toEqual(['page', null]);
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('role="group"');
  });
});
