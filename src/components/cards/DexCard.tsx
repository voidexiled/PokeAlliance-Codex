import type { HTMLAttributes, ReactNode } from 'react';

import { Card, Head, Meta, Title, Zone } from '@/components/cards/Card';
import type { CardHeadingLevel } from '@/components/cards/Card';
import { FactList } from '@/components/cards/FactList';
import type { FactRow } from '@/components/cards/FactList';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { ElementIcon } from '@/components/game/ElementIcon';
import { NestedEntity } from '@/components/game/NestedEntity';
import { PokemonArt } from '@/components/game/ShinyMark';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { TierValue } from '@/components/game/TierBadge';
import { PlusN } from '@/components/money/PlusN';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { trackCount } from '@/lib/cards/layout';
import type { DexKey, DexLayout } from '@/lib/cards/layout';
import type { PokemonTier } from '@/lib/content/types';
import { formatInteger } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';

// DexCard (spec 7.2.6, 7.5.5, 7.5.10, 7.6.2, 7.6.4, 8.2; CARD_GRID_SYSTEM §6.2, §9;
// DS:DexCard, DS:guias/30): the Pokédex entry card of the Cards view — art of 64, name and
// number, the facts Requisito, Tier, Rol and Variante, one line of element chips and the
// drops — built on the card kit of `Card.tsx`, inside `CardGrid family="pokedex"`.
//
// Markup and `ac-dex-card*` classes are the reference's (`bundle.js` DexCard), so
// dex-card.css ports its block. What the site does differently:
//
//   - The layout (7.6.2, 7.6.3). `layout` is `dexLayout` of the entries the grid shows, the
//     same for every card of the grid: the facts are the ones of the union and the element
//     and drop zones exist when one entry of the grid has them, so with twelve Pokémon
//     without tier or role on the page the grid has neither track. The card spans
//     `trackCount('pokedex', layout)` tracks and never fixes Z by hand.
//   - The compact anatomy is not a prop (7.6.4). A grid narrower than 495
//     (`layout-dex-compact`) switches it with container queries, with no JavaScript and the
//     same DOM: card.css stacks and centres the head and gives the title two lines,
//     element-chip.css turns each chip into a round icon of 24, and dex-card.css turns the
//     meta into «Nº 6 · Gen. 1», centres the zones and lays the drops out as slots only,
//     three to a line. There is no `side` either (7.5.5): the element and drop panels open
//     `down` with the `auto` alignment, which the controller measures against the card, and
//     in the compact anatomy the `--ac-tt-align: column` of card.css makes it measure the
//     column of the card in its grid instead.
//   - Drops (7.6.4). Each drop is one `li` with `data-regular="slot|chip|hidden"` and
//     `data-compact="slot|hidden"`, decided here. Regular: every drop with a sprite is a
//     slot of 36, then up to 3 without one are named chips (with more, 2 and «+N»). Compact:
//     slots only, at most 6 (with more, 5 and a square «+N» of 36), a drop without a sprite
//     being a slot with the missing mark. One DOM serves both, so the drops keep one order
//     in both: the ones with a sprite first, then the rest, each in the order of the
//     registry — the order the regular strip needs; the reference, which draws the two
//     anatomies apart, keeps the registry order in the compact one. There are two «+N»,
//     `data-variant="regular"` and `"compact"`, and each one is `display: none` in the other
//     anatomy, which takes it out of the tab order and of the accessibility tree, as it does
//     with every drop its anatomy hides.
//   - A drop trigger is the `NestedEntity` of its item and always carries its name as
//     `aria-label`; its panel is `itemTip` (`TipData`, DP3), opened `down`. An item without
//     a page of its own — every item of this cut (§15) — has a button as its trigger
//     (7.5.7). A drop whose panel has nothing below its title is plain text, with no link
//     and no tooltip (R2, 8.0.5): the same slot or chip, its name for screen readers only
//     where the slot shows no text.
//   - The meta line writes each part only when the registry has it (8.2), «Nº {n}» and the
//     generation, and it is written twice, «Nº 6 · Generación 1» and «Nº 6 · Gen. 1», of
//     which the container query shows one.
//   - `entry.art` is the URL of the Pokémon art (`resolvePokemonImage`) or `null`; the art
//     is an illustration drawn smooth at 64 (7.4.2), with the golden glow when the entry is
//     shiny (plan «Shiny»: no mark over it, «Shiny» stays as the Variante text), and the
//     client Pokédex «?» at 48 without art or when it fails (plan «?»). `loading` is the
//     `lazy` of 7.4.2 for a card from the fifth of its list on (index 4 and up).
//   - The facts of the board Pokedex-Cards (plan «Cards»): Requisito, Tier, Rol, Variante,
//     Tipo, Moveset. Tier is `TierValue` — the tier as text with a dotted underline that
//     opens its tooltip («Max brokes: —») — when the entry brings `tierValue`, and «—» for a
//     hidden tier (ULTIMATE). With `labels.type`, the elements are the «Tipo» fact and the
//     moveset (`movesetElements`) the «Moveset» fact, both as `ElementIcon`s — the icon
//     alone at 24, its name in a small game tooltip — one row track each, so the card keeps
//     the tracks of `trackCount` (the «elements» zone becomes the «Tipo» row). Without
//     `labels.type`, the chip zone under the facts is drawn as before.
//   - `headingLevel` (7.6.2): the level of the title, when the card is rendered where it
//     cannot see the one of its grid (each card of an `.astro` page is its own React root).
//
// The card is not a link and never opens a tooltip: its title is the link, and its element
// chips and drops are the triggers (7.5.10). Every text arrives by props (DP1): `labels`,
// and `hint`, the strip of the panels.

/** One drop of the entry, from `drops` of `content/pokemon.json` (8.0.5). */
export interface DexCardDrop {
  /** Name of the item: the accessible name of its slot, and the text of its chip. */
  name: string;
  /**
   * Sprite of the item as the adapter resolves it (DP2). `null`: a named chip in the regular
   * anatomy, a slot with the missing mark in the compact one.
   */
  sprite: SpriteProps | null;
  /**
   * Panel of the item, `itemTip` (7.5.3). `null`, missing (the first page of the Pokédex, whose
   * island builds it after hydrating) or nothing below its title: plain text (R2).
   */
  tip?: TipData | null;
  /** Page of the item. Without it the trigger is a button (7.5.7). */
  href?: string;
}

/** A Pokédex entry as the card reads it: `content/pokemon.json` already written (8.0.5). */
export interface DexCardEntry {
  name: string;
  /** Page of the Pokémon. Without it the title is text. */
  href?: string;
  /** `numero`: «Nº 6». */
  number?: number | null;
  /** `generacion`: «Generación 1». */
  generation?: number | null;
  /** URL of the art (`resolvePokemonImage`), or `null`: the missing mark. */
  art: string | null;
  /** `nivel`, the value of Requisito: «Nivel 80». */
  level?: number | null;
  /**
   * `formatTier(tier)`: «T3», «Legendary»; or the caller's node. Ignored when `tierValue`
   * is given.
   */
  tier?: ReactNode;
  /**
   * The registry `tier` (plan «Tier tooltip»): the Tier fact becomes `TierValue`, the dotted
   * text that opens the tier tooltip, and «—» for a tier the site hides (ULTIMATE).
   */
  tierValue?: PokemonTier | null;
  /** The «Moveset» fact (§16.4.2): the chip of `elementoMoveset`, built by the caller. */
  moveset?: ReactNode;
  /**
   * The elements of the moveset (plan «Cards»): the «Moveset» fact as `ElementIcon`s, like
   * «Tipo». With it `moveset` is ignored.
   */
  movesetElements?: readonly ElementChipEntry[];
  /** `funcion`: «PVE». */
  role?: string | null;
  /** `variante`. */
  variant?: 'normal' | 'shiny' | null;
  /** Elements in the order of 8.0.5, as `ElementChip` takes them. */
  elements?: readonly ElementChipEntry[];
  /** Drops in the order of the registry. */
  drops?: readonly DexCardDrop[];
  /** The entry of the page itself: no link, `aria-current="page"` on its name (§8.3). */
  current?: boolean;
}

/** Every text of the card (DP1): `ui.tooltip` has several of them, the rest the page's namespace. */
export interface DexCardLabels {
  /** «Nº {n}» / «No. {n}». */
  number: string;
  /** «Generación {n}» / «Generation {n}». */
  generation: string;
  /** «Gen. {n}»: the meta of the compact anatomy. */
  generationShort: string;
  /** «Requisito» / «Requirement». */
  requirement: string;
  /** «Nivel {n}» / «Level {n}»: the value of Requisito (13.3). */
  level: string;
  /** «Tier», a game term (13.4). */
  tier: string;
  /** «Rol» / «Role». */
  role: string;
  /** «Moveset», a game term (13.4). */
  moveset?: string;
  /**
   * «Tipo» / «Type»: the label of the elements fact (plan «Cards»). With it the elements are
   * the «Tipo» fact as icons; without it, the chip zone under the facts.
   */
  type?: string;
  /** «Max brokes», a game term (13.4): the row of the tier tooltip (`ui.filterBar.maxBrokes`). */
  maxBrokes?: string;
  /** «Variante» / «Variant». */
  variant: string;
  /** «Normal». */
  normal: string;
  /** «Shiny», a game term (13.4): the Variante value of a shiny entry. */
  shiny: string;
  /** «Drops»: the label of the zone and the name of its list. */
  drops: string;
  /** Name of a «+N»: «{n} drops más: {names}» / «{n} more drops: {names}», singular and plural. */
  moreDrops: MessageLeaf;
}

export interface DexCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  entry: DexCardEntry;
  /** `dexLayout` of the entries of the grid: the same for every card of it (7.6.3). */
  layout: DexLayout;
  labels: DexCardLabels;
  /** Picks the format of the figures, here and in the panels (C-R3). */
  locale: Locale;
  /** Strip of the panels, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Named drop chips before «+N» in the regular anatomy. Default 3 (CARD_GRID_SYSTEM §9). */
  chipCap?: number;
  /** Level of the title, when the card cannot see the one of its grid (7.6.2). */
  headingLevel?: CardHeadingLevel;
  /** `lazy` for a card from index 4 of its list on (7.4.2). */
  loading?: 'lazy' | 'eager';
}

/** Compact drops: 3 a line, at most 6 slots; past 6, 5 slots and «+N» (7.6.4). */
const COMPACT_MAX = 6;
/** Named drop chips of the regular anatomy before «+N» (CARD_GRID_SYSTEM §9). */
const CHIP_CAP = 3;
/** Size of the art in the head (`size-art`). */
const ART = 64;

type RegularForm = 'slot' | 'chip' | 'hidden';
type CompactForm = 'slot' | 'hidden';

interface PlacedDrop {
  drop: DexCardDrop;
  regular: RegularForm;
  compact: CompactForm;
}

interface DropStrip {
  /** Every drop, in DOM order: the ones with a sprite first, then the rest. */
  placed: PlacedDrop[];
  /** What the regular «+N» lists: the named drops past the chip cap. */
  regularRest: DexCardDrop[];
  /** What the compact «+N» lists: the drops past the fifth slot. */
  compactRest: DexCardDrop[];
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData | null | undefined): tip is TipData {
  if (!tip) return false;
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

/** A whole number the card can show (the registry writes `null` for the unknown ones). */
function known(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The forms of every drop in each anatomy (7.6.4). */
function placeDrops(drops: readonly DexCardDrop[], chipCap: number): DropStrip {
  const withSprite = drops.filter((drop) => drop.sprite);
  const named = drops.filter((drop) => !drop.sprite);
  const cap = Math.max(1, Math.trunc(chipCap));
  // Up to the cap every named drop is a chip; past it, cap − 1 chips and a «+N».
  const chips = named.length <= cap ? named.length : cap - 1;
  const ordered = [...withSprite, ...named];
  const slots = ordered.length <= COMPACT_MAX ? ordered.length : COMPACT_MAX - 1;
  return {
    placed: ordered.map((drop, index) => ({
      drop,
      regular: drop.sprite ? 'slot' : index - withSprite.length < chips ? 'chip' : 'hidden',
      compact: index < slots ? 'slot' : 'hidden',
    })),
    regularRest: named.slice(chips),
    compactRest: ordered.slice(slots),
  };
}

export function DexCard({
  entry,
  layout,
  labels,
  locale,
  hint,
  chipCap = CHIP_CAP,
  headingLevel,
  loading,
  className,
  ...rest
}: DexCardProps) {
  /** The 32 game cell of a drop at 1x: its sprite, or the missing mark (7.4.4). */
  const cell = (drop: DexCardDrop) => (
    <SpriteStage
      sprite={drop.sprite ? { ...drop.sprite, loading } : null}
      size={32}
      framed={false}
      className="ac-dex-card__cell"
    />
  );

  /** «2 drops más: Dark Wing, Mythic Fire Orb»: the name of a «+N». */
  const moreLabel = (hidden: readonly DexCardDrop[]) => {
    const template = isPluralMessage(labels.moreDrops)
      ? plural(locale, hidden.length, labels.moreDrops)
      : labels.moreDrops;
    return fill(template, {
      n: formatInteger(hidden.length, locale),
      names: hidden.map((drop) => drop.name).join(', '),
    });
  };

  // ---------------------------------------------------------------------------------- head
  // Art of 64 with the Shiny glow (the «?» without it), the name on one line (two in the
  // compact anatomy, card.css) and the meta line with the parts the registry has.
  const number = known(entry.number) ? fill(labels.number, { n: String(entry.number) }) : null;
  const line = (generation: string | null) =>
    [number, generation].filter((part): part is string => part !== null).join(' · ');
  let meta: ReactNode = number;
  if (known(entry.generation)) {
    const n = String(entry.generation);
    // The whole line twice, long and short, so each one is a single run of text; the
    // container query shows one of them (dex-card.css).
    meta = (
      <>
        <span className="ac-dex-card__long">{line(fill(labels.generation, { n }))}</span>
        <span className="ac-dex-card__short">{line(fill(labels.generationShort, { n }))}</span>
      </>
    );
  }
  const head = (
    <Head
      stage={
        <span className="ac-sprite-stage ac-sprite-stage--64 ac-dex-card__art" aria-hidden="true">
          <PokemonArt
            src={entry.art === '' ? null : entry.art}
            size={ART}
            shiny={entry.variant === 'shiny'}
            loading={loading}
          />
        </span>
      }
      title={
        <Title href={entry.href} clamp={1} current={entry.current}>
          {entry.name}
        </Title>
      }
      lines={meta === null ? null : <Meta>{meta}</Meta>}
    />
  );

  // --------------------------------------------------------------------------------- facts
  const fact = (key: DexKey): FactRow => {
    switch (key) {
      case 'requirement':
        return {
          key,
          label: labels.requirement,
          value: known(entry.level)
            ? fill(labels.level, { n: formatInteger(entry.level, locale) })
            : null,
        };
      case 'tier':
        if (entry.tierValue !== undefined) {
          return {
            key,
            label: labels.tier,
            mode: 'node',
            value: (
              <TierValue
                tier={entry.tierValue}
                maxBrokesLabel={labels.maxBrokes ?? 'Max brokes'}
                locale={locale}
              />
            ),
          };
        }
        return {
          key,
          label: labels.tier,
          mode: typeof entry.tier === 'object' && entry.tier !== null ? 'node' : 'clip',
          value: entry.tier,
        };
      case 'moveset':
        return {
          key,
          label: labels.moveset ?? 'Moveset',
          mode: 'node',
          value: entry.movesetElements ? icons(entry.movesetElements) : entry.moveset,
        };
      case 'role':
        return { key, label: labels.role, value: entry.role };
      case 'variant':
        return {
          key,
          label: labels.variant,
          mode: 'node',
          value:
            entry.variant === 'shiny'
              ? labels.shiny
              : entry.variant === 'normal'
                ? labels.normal
                : null,
        };
    }
  };
  // Tipo and Moveset (plan «Cards»): the icons of the elements, 4 apart; none is «—».
  function icons(list: readonly ElementChipEntry[]): ReactNode {
    if (list.length === 0) return null;
    return (
      <span className="ac-dex-card__icons">
        {list.map((element) => (
          <ElementIcon key={element.id} element={element} />
        ))}
      </span>
    );
  }
  const typeRow = labels.type !== undefined && layout.zones.includes('elements');
  const rows: FactRow[] = layout.keys.filter((key) => key !== 'moveset').map(fact);
  if (typeRow) {
    rows.push({
      key: 'type',
      label: labels.type ?? '',
      mode: 'node',
      value: icons(entry.elements ?? []),
    });
  }
  if (layout.keys.includes('moveset')) rows.push(fact('moveset'));

  // ------------------------------------------------------------------------------ elements
  const elements =
    layout.zones.includes('elements') && !typeRow ? (
      <Zone name="elements" className="ac-dex-card__elements">
        {(entry.elements ?? []).map((element) => (
          <ElementChip
            key={element.id}
            element={element}
            variant="chip"
            placement="down"
            align="auto"
            locale={locale}
            hint={hint}
          />
        ))}
      </Zone>
    ) : null;

  // --------------------------------------------------------------------------------- drops
  let drops: ReactNode = null;
  if (layout.zones.includes('drops')) {
    const list = entry.drops ?? [];
    let body: ReactNode;
    if (list.length === 0) {
      // A zone the grid has and this entry has nothing in: the dash (CARD_GRID_SYSTEM §6.2).
      body = <p className="ac-dex-card__none">{UNKNOWN}</p>;
    } else {
      const strip = placeDrops(list, chipCap);
      body = (
        <ul aria-label={labels.drops} className="ac-dex-card__drops">
          {strip.placed.map(({ drop, regular, compact }, index) => {
            const chip = !drop.sprite;
            let item: ReactNode;
            if (hasContent(drop.tip)) {
              item = (
                <NestedEntity
                  tip={drop.tip}
                  href={drop.href}
                  variant={chip ? 'chip-text' : 'plain'}
                  placement="down"
                  align="auto"
                  ariaLabel={drop.name}
                  locale={locale}
                  hint={hint}
                  className={chip ? 'ac-dex-card__chip' : 'ac-dex-card__slot'}
                >
                  {cell(drop)}
                  {chip ? <span className="ac-dex-card__name">{drop.name}</span> : null}
                </NestedEntity>
              );
            } else if (chip) {
              // R2: the static chip of `Chip`, with the cell the compact anatomy shows.
              item = (
                <span className="ac-chip ac-dex-card__chip">
                  {cell(drop)}
                  <span className="ac-dex-card__name">{drop.name}</span>
                </span>
              );
            } else {
              item = (
                <span className="ac-dex-card__slot">
                  {cell(drop)}
                  <span className="sr-only">{drop.name}</span>
                </span>
              );
            }
            return (
              // The drops are the entry's fixed sequence: position is identity.
              <li
                key={index}
                className="ac-dex-card__li"
                data-regular={regular}
                data-compact={compact}
              >
                {item}
              </li>
            );
          })}
          {strip.regularRest.length > 0 ? (
            <li className="ac-dex-card__li" data-variant="regular">
              <PlusN
                placement="down"
                label={moreLabel(strip.regularRest)}
                items={strip.regularRest.map((drop) => drop.name)}
              />
            </li>
          ) : null}
          {strip.compactRest.length > 0 ? (
            <li className="ac-dex-card__li" data-variant="compact">
              <PlusN
                size={36}
                placement="down"
                label={moreLabel(strip.compactRest)}
                items={strip.compactRest.map((drop) => (
                  <span className="ac-dex-card__more">
                    {cell(drop)}
                    {drop.name}
                  </span>
                ))}
              />
            </li>
          ) : null}
        </ul>
      );
    }
    drops = (
      <Zone name="drops">
        <p className="ac-dex-card__label">{labels.drops}</p>
        {body}
      </Zone>
    );
  }

  return (
    <Card
      {...rest}
      anat="dex"
      span={trackCount('pokedex', layout)}
      headingLevel={headingLevel}
      className={classes('ac-dex-card', className)}
    >
      {head}
      {rows.length > 0 ? <FactList rows={rows} /> : null}
      {elements}
      {drops}
    </Card>
  );
}
