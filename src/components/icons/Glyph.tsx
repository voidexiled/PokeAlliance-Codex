import { Icon, type LucideIconNode } from 'lucide-react';

// Glyph (spec C-R7, C7-15, DS:README §Iconografía): the only SVG of the site and
// the only file that imports lucide-react.
//
// Everything that names an item, a Pokémon, a system or an amount is a game sprite
// (§7.4). What is left are the twelve utility glyphs of the frame and of the
// controls — the magnifier, the chevrons, the globe, the menu, the close, the arrow,
// the check and the three sort arrows — and they all come through here. ESLint
// (`no-restricted-imports`) and scripts/design/check.mjs rule 9 both fail on a
// lucide-react import from any other file, so this component is the seam.
//
// `moon` is deliberately absent: X2 and Q6 leave the site on the dark theme alone,
// so a theme switch has no glyph to draw until the owner asks for a light one.
//
// The glyph is always decorative: `aria-hidden="true"` and `focusable="false"`, with
// the accessible name coming from the visible text of its control or from its
// `aria-label` (§7.5.7). There is no `title` and no label prop on purpose — a glyph
// that needs a name belongs inside a control that already has one.
//
// Why lucide's `Icon` with the shapes written out here, and not lucide's named
// icons (R17 keeps lucide as the renderer; the approved design keeps the shapes):
//
// - The shapes are the ones DS components/bundle.js draws, path for path. The design
//   system copied them from an older lucide; the installed 1.43 has since redrawn
//   `menu` (bars at 5/12/19 instead of 6/12/18) and `search` (a 4.34 handle instead
//   of 4.3). Its named icons would move pixels of the approved boards (§14.5).
// - A named lucide icon also writes a `lucide-<name>` class on its svg. On a chevron
//   that is `lucide-chevron-right`, which tests/e2e/contract.spec.ts (G8) reads as a
//   chevron control: the breadcrumb separator would count as a chevron that opens
//   nothing. `Icon` with a bare node writes only `lucide`, which is also what
//   tests/e2e/tooltip.spec.ts uses to tell a Glyph from a stray SVG.
//
// Bundle size (§13.6). `Glyph` looks its shape up by `name`, so whatever imports it
// carries all twelve shapes. That costs nothing on the server, where every frame
// component and control renders. A client island may import a one-glyph export
// (`ChevronRightGlyph`), which drops the other shapes only while no island of the
// build imports `Glyph`: once one does, this module is one shared chunk with all of
// them. The search palette, in the initial JavaScript of every page, does not import
// this module at all: `PageLayout` renders its magnifier and passes it as a slot.
//
// Note for whoever compares classes against the design system (C7-02): lucide writes
// its own `lucide` class and an `xmlns` on the svg it renders. The `ac-*` class of the
// caller arrives through `className` and is appended to them.

/** C-R7: the twelve utility glyphs. No other name exists, and `moon` is not one of them. */
export type GlyphName =
  | 'search'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'globe'
  | 'menu'
  | 'close'
  | 'arrow-right'
  | 'check'
  | 'sort'
  | 'sort-up'
  | 'sort-down';

/** C-R7: the four sizes the design system draws these glyphs at. */
export type GlyphSize = 12 | 14 | 16 | 18;

/** One glyph: the shape lucide's `Icon` draws and the size it takes by default. */
interface Shape {
  node: LucideIconNode[];
  /**
   * The size of `DS:README §Iconografía`: «lupa 16, chevrones 12 a 16, globo 16,
   * luna y menú 18, cerrar 14, flecha 12, check 12 y 16, flechas de orden 12». Where
   * the guide gives a range or two values, the default is the larger one; a caller
   * that needs another size passes `size`.
   */
  size: GlyphSize;
}

// The shapes of DS components/bundle.js, in its element order, on lucide's 24 grid.
// React needs a `key` on each child: lucide's `Icon` renders them as a list.

const SEARCH: Shape = {
  size: 16,
  node: [
    ['circle', { key: 'a', cx: 11, cy: 11, r: 8 }],
    ['path', { key: 'b', d: 'm21 21-4.3-4.3' }],
  ],
};

const CHEVRON_DOWN: Shape = { size: 16, node: [['path', { key: 'a', d: 'm6 9 6 6 6-6' }]] };

const CHEVRON_UP: Shape = { size: 16, node: [['path', { key: 'a', d: 'm18 15-6-6-6 6' }]] };

const CHEVRON_RIGHT: Shape = { size: 16, node: [['path', { key: 'a', d: 'm9 18 6-6-6-6' }]] };

const GLOBE: Shape = {
  size: 16,
  node: [
    ['circle', { key: 'a', cx: 12, cy: 12, r: 10 }],
    ['path', { key: 'b', d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
    ['path', { key: 'c', d: 'M2 12h20' }],
  ],
};

const MENU: Shape = {
  size: 18,
  node: [
    ['path', { key: 'a', d: 'M4 12h16' }],
    ['path', { key: 'b', d: 'M4 6h16' }],
    ['path', { key: 'c', d: 'M4 18h16' }],
  ],
};

const CLOSE: Shape = {
  size: 14,
  node: [
    ['path', { key: 'a', d: 'M18 6 6 18' }],
    ['path', { key: 'b', d: 'm6 6 12 12' }],
  ],
};

const ARROW_RIGHT: Shape = {
  size: 12,
  node: [
    ['path', { key: 'a', d: 'M5 12h14' }],
    ['path', { key: 'b', d: 'm12 5 7 7-7 7' }],
  ],
};

const CHECK: Shape = { size: 16, node: [['path', { key: 'a', d: 'M20 6 9 17l-5-5' }]] };

// DS:DataTable §Estados: idle is the double chevron, the active direction an arrow.
const SORT: Shape = {
  size: 12,
  node: [
    ['path', { key: 'a', d: 'm7 15 5 5 5-5' }],
    ['path', { key: 'b', d: 'm7 9 5-5 5 5' }],
  ],
};

const SORT_UP: Shape = {
  size: 12,
  node: [
    ['path', { key: 'a', d: 'm5 12 7-7 7 7' }],
    ['path', { key: 'b', d: 'M12 19V5' }],
  ],
};

const SORT_DOWN: Shape = {
  size: 12,
  node: [
    ['path', { key: 'a', d: 'M12 5v14' }],
    ['path', { key: 'b', d: 'm19 12-7 7-7-7' }],
  ],
};

const SHAPES: Record<GlyphName, Shape> = {
  search: SEARCH,
  'chevron-down': CHEVRON_DOWN,
  'chevron-up': CHEVRON_UP,
  'chevron-right': CHEVRON_RIGHT,
  globe: GLOBE,
  menu: MENU,
  close: CLOSE,
  'arrow-right': ARROW_RIGHT,
  check: CHECK,
  sort: SORT,
  'sort-up': SORT_UP,
  'sort-down': SORT_DOWN,
};

/** C-R7: stroke 2, and 2.5 on the 12 px glyphs so they keep their weight. */
const SMALL_SIZE: GlyphSize = 12;
const STROKE = 2;
const SMALL_STROKE = 2.5;

export interface GlyphProps {
  /** Defaults to the size `DS:README §Iconografía` gives this glyph. */
  size?: GlyphSize;
  /** The `ac-*` class of the caller, its own block element (§3.8). */
  className?: string;
}

interface Props extends GlyphProps {
  name: GlyphName;
}

function draw(shape: Shape, { size = shape.size, className }: GlyphProps) {
  return (
    <Icon
      iconNode={shape.node}
      size={size}
      strokeWidth={size === SMALL_SIZE ? SMALL_STROKE : STROKE}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export function Glyph({ name, ...props }: Props) {
  return draw(SHAPES[name], props);
}

/** `<Glyph name="chevron-right" />` for a client island (see «Bundle size» above). */
export function ChevronRightGlyph(props: GlyphProps) {
  return draw(CHEVRON_RIGHT, props);
}
