import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { ShinyMark } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import { MissingSprite, SpriteStage } from '@/components/game/SpriteStage';
import { Glyph } from '@/components/icons/Glyph';
import { DiamondsAmount } from '@/components/money/DiamondsAmount';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import { PriceOptions } from '@/components/money/PriceOptions';
import { TrainingMeter } from '@/components/money/TrainingMeter';
import type { Locale } from '@/i18n/config';
import { present } from '@/lib/format/unknown';
import type { TipData, TipHead, TipRow, TipSection, TipValue } from '@/lib/game/tips';

// GameTooltip (spec 7.5, DS:GameTooltip, DS:guias/10): the in-game panel of the
// PokeAlliance client, painted from a `TipData` (DP3). It is the signature surface
// of the site and the only one with Poppins, the `tt-label` colour and the game
// text shadow.
//
// It is a TSX server component (C-R1): it is prerendered next to its trigger and
// also reused inside an island, and it ships no JavaScript of its own. What opens,
// closes, pins and positions it is the single delegated controller of 7.5.4,
// `src/scripts/game-tooltip.ts`, over the `popover="manual"` panel that
// `NestedEntity` puts next to the trigger (7.5.1).
//
// Two shapes:
//
// - `variant="popover"` (default): `role="tooltip"`, the "Mantén Shift para fijar"
//   strip and the 150 ms entry;
// - `variant="sheet"` (7.5.9): the static sheet of a detail page, in the flow of
//   the page, `role="group"` with its own `aria-label`, no strip and no animation.
//
// A row with no value never reaches this component: the constructors of 7.5.3 only
// emit rows that have one, and a row that gets here without one is dropped. "—" is
// never written inside a tooltip (X13/T32, C-R5).
//
// Every amount of a row is a money component of 7.2.5 (S8, 7.8): `{ pd }` is a
// `PokedolaresAmount`, `{ dia }` a `DiamondsAmount` without a link and `{ price }` a
// `PriceOptions` in its `tooltip` variant, so each figure carries the Pokédólares sprite
// or the Diamond before it and a screen reader hears the exact amount (R5). The training
// section is the `tooltip` shape of `TrainingMeter`.
//
// Every visible text arrives as a prop (DP1): the panel carries no copy of its own
// and `locale` only picks the format of the numbers (C-R3).

/** The element names of the panel, so `inline` can swap them for phrasing content. */
interface Tags {
  div: 'div' | 'span';
  p: 'p' | 'span';
  dl: 'dl' | 'span';
  dt: 'dt' | 'span';
  dd: 'dd' | 'span';
}

const BLOCK_TAGS: Tags = { div: 'div', p: 'p', dl: 'dl', dt: 'dt', dd: 'dd' };
const INLINE_TAGS: Tags = { div: 'span', p: 'span', dl: 'span', dt: 'span', dd: 'span' };

export interface GameTooltipProps {
  /** The panel's content, built by a constructor of `src/lib/game/tips.ts` (7.5.3). */
  tip: TipData;
  /** 'popover' (default) or 'sheet', the static sheet of a detail page (7.5.9). */
  variant?: 'popover' | 'sheet';
  /**
   * Phrasing-only markup (spans), for a panel that hangs from a mention inside a
   * paragraph: a `div` may not sit inside a `<p>`. An inline panel shows no
   * sections, which are `<details>` and are flow content (7.5.2).
   */
  inline?: boolean;
  /** Id of the panel, which the trigger points at with `aria-describedby` (7.5.7). */
  id?: string;
  /** `NestedEntity` sets it, so the panel opens in the top layer (7.5.1, C-R2). */
  popover?: 'manual';
  /** Picks the format of the amounts. It never picks a text (DP1). */
  locale: Locale;
  /** Text of the strip, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint?: string;
  /** Accessible name of the sheet: «Ficha de Shiny Charizard» / «Shiny Charizard sheet». */
  ariaLabel?: string;
  /** Accessible name of the Shiny mark. "Shiny" is a game term in both locales (13.4). */
  shinyLabel?: string;
  /**
   * The word between two price options, `ui.or`: «o» / «or» (13.3). A row with two
   * options fails without it, instead of joining them with anything else.
   */
  orLabel?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** A value never breaks inside itself; a comma list breaks only between its entries. */
function phrase(text: string): ReactNode {
  const parts = text.split(', ');
  if (parts.length === 1) return <span className="ac-game-tooltip__nw">{text}</span>;
  return parts.map((part, index) => (
    // The list is a fixed sequence built by a constructor, so its position is its identity.
    <Fragment key={index}>
      {index > 0 ? ', ' : null}
      <span className="ac-game-tooltip__nw">{part}</span>
    </Fragment>
  ));
}

/**
 * Whether a value has anything to show: a known text, a list with an entry, a known
 * amount or at least one price option with one. A row without it is dropped (T32).
 */
function shows(value: TipValue): boolean {
  if (typeof value === 'string') return present(value);
  if ('list' in value) return value.list.some((entry) => present(entry));
  if ('price' in value) return value.price.some((option) => Number.isFinite(option.amount));
  if ('pd' in value) return Number.isFinite(value.pd);
  return Number.isFinite(value.dia);
}

/**
 * The value of a row. An amount is the money component of 7.2.5 (S8): the short form
 * the players read after its sprite, and the exact figure for a screen reader (§4.3, R5).
 */
function valueNode(value: TipValue, locale: Locale, orLabel: string | undefined): ReactNode {
  if (typeof value === 'string') return phrase(value);
  if ('list' in value) return phrase(value.list.filter((entry) => present(entry)).join(', '));
  if ('pd' in value) return <PokedolaresAmount amount={value.pd} locale={locale} />;
  // A Diamonds amount inside a panel is never a link (7.5.2: «DiamondsAmount sin enlace»).
  if ('dia' in value) return <DiamondsAmount amount={value.dia} locale={locale} />;
  // Price options: each «o» travels with its option and no currency is ever converted or
  // added to another (7.8). The word is `ui.or` (13.3): two options cannot do without it,
  // and a single one never writes it.
  const options = value.price.filter((option) => Number.isFinite(option.amount));
  if (options.length > 1 && orLabel === undefined) {
    throw new Error(
      'GameTooltip: two price options need `orLabel` (ui.or), on the panel or on its NestedEntity (DP1).',
    );
  }
  return (
    <PriceOptions options={options} locale={locale} orLabel={orLabel ?? ''} variant="tooltip" />
  );
}

/** Label of a row, which always ends in a colon: «Requisito:», «Tier:». */
function withColon(label: string): string {
  return /:\s*$/.test(label) ? label : `${label}:`;
}

function Rows({
  rows,
  grid,
  tags,
  locale,
  orLabel,
}: {
  rows: TipRow[];
  grid: boolean;
  tags: Tags;
  locale: Locale;
  orLabel: string | undefined;
}) {
  if (rows.length === 0) return null;
  const Dl = tags.dl;
  const Dt = tags.dt;
  const Dd = tags.dd;
  const Row = tags.div;
  const className = grid
    ? 'ac-game-tooltip__rows ac-game-tooltip__rows--grid'
    : 'ac-game-tooltip__rows';

  // The two-column grid of a listing puts every label and every value in the same
  // flow, so the two columns line up across the whole block; one flex row per pair
  // is what every other panel uses (DS:guias/10 "Anatomía").
  if (grid) {
    return (
      <Dl className={className}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            <Dt className="ac-game-tooltip__label">{withColon(row.label)}</Dt>
            <Dd className="ac-game-tooltip__value" lang={row.lang}>
              {valueNode(row.value, locale, orLabel)}
            </Dd>
          </Fragment>
        ))}
      </Dl>
    );
  }

  return (
    <Dl className={className}>
      {rows.map((row, index) => (
        <Row key={index} className="ac-game-tooltip__row">
          <Dt className="ac-game-tooltip__label">{withColon(row.label)}</Dt>
          <Dd className="ac-game-tooltip__value" lang={row.lang}>
            {valueNode(row.value, locale, orLabel)}
          </Dd>
        </Row>
      ))}
    </Dl>
  );
}

/**
 * The chevron of a section, 12 px at stroke 2.5: down while the section is open, right
 * while it is closed, as in the reference. The only SVG of the site is `Glyph` (C-R7), so
 * the two directions are two glyphs and `game-tooltip.css` shows the one the `[open]`
 * state of the `<details>` asks for: that way it folds with no JavaScript.
 */
function Chevron() {
  return (
    <span className="ac-game-tooltip__chevron" aria-hidden="true">
      <Glyph name="chevron-down" size={12} className="ac-game-tooltip__chevron-open" />
      <Glyph name="chevron-right" size={12} className="ac-game-tooltip__chevron-closed" />
    </span>
  );
}

/**
 * A collapsible section, open from the first paint. It is `<details>` with a
 * `<summary>` and not the button of the reference (C-R2), so it folds with no
 * JavaScript inside static HTML and the browser exposes the expanded state itself.
 */
function Section({
  section,
  first,
  locale,
}: {
  section: TipSection;
  first: boolean;
  locale: Locale;
}) {
  const className = first
    ? 'ac-game-tooltip__section ac-game-tooltip__section--first'
    : 'ac-game-tooltip__section';

  return (
    <details className={className} open>
      <summary className="ac-game-tooltip__toggle">
        {section.label}
        <Chevron />
      </summary>
      {section.kind === 'held' ? (
        <div className="ac-game-tooltip__held">
          {section.items.map((item, index) => (
            <span key={index} className="ac-game-tooltip__held-item">
              <SpriteStage sprite={item.sprite} size={32} framed={false} />
              {item.name}
            </span>
          ))}
        </div>
      ) : (
        // Training: each skill with «16 (53%)» and the 4 px meter, the tooltip shape of
        // `TrainingMeter` (7.2.5), in the order it arrives (§9.5.9). The panel has no
        // dictionary at hand, so each meter is named by its own row («Attack 16 (53%)»).
        <div className="ac-game-tooltip__section-body">
          {section.skills.map((skill) => (
            <TrainingMeter
              key={skill.stat}
              variant="tooltip"
              stat={skill.stat}
              level={skill.level}
              percent={skill.percent}
              locale={locale}
            />
          ))}
        </div>
      )}
    </details>
  );
}

function Head({
  head,
  title,
  shiny,
  shinyLabel,
  tags,
}: {
  head: TipHead;
  title: string;
  shiny: boolean;
  shinyLabel: string;
  tags: Tags;
}) {
  const Box = tags.div;
  const Title = tags.p;
  const className = shiny
    ? 'ac-game-tooltip__head ac-game-tooltip__head--shiny'
    : 'ac-game-tooltip__head';

  let image: ReactNode = null;
  if (head.type === 'sprite') {
    // Item, ball or currency: its game cell at 2x (64). `null` is a known entity with
    // no sprite in its registry, and the box draws the 32 missing mark (DP2).
    image = <SpriteStage sprite={head.sprite} size={64} framed={false} />;
  } else if (head.type === 'art') {
    // A Pokémon with no art is a known entity with no image: the 32 missing mark in the
    // 64 cell, as an item with no sprite (DS:guias/10 "Anatomía"), not an empty 72 box.
    image =
      head.src === null ? (
        <SpriteStage sprite={null} size={64} framed={false} />
      ) : (
        <span className="ac-game-tooltip__art">
          {/* Pokémon art: 70 px smooth in a 72 box. It goes through `Sprite` so
              `art-loading.ts` can pulse the box while the remote image loads (7.4.2). */}
          <Sprite
            className="ac-game-tooltip__art-img"
            src={head.src}
            smooth
            width={70}
            height={70}
            alt=""
          />
          {head.aura ? (
            <span className="ac-game-tooltip__aura" role="img" aria-label={head.aura.label}>
              <Sprite {...head.aura.sprite} alt="" />
            </span>
          ) : null}
        </span>
      );
  } else if (head.type === 'icon') {
    // Element icon: the 100 px illustration of the registry, drawn smooth at 32.
    image =
      head.sprite === null ? (
        <MissingSprite size={32} />
      ) : (
        <Sprite {...head.sprite} smooth width={32} height={32} alt="" />
      );
  }

  return (
    <Box className={className}>
      {shiny ? <ShinyMark corner="tooltip" label={shinyLabel} /> : null}
      {image}
      {title ? <Title className="ac-game-tooltip__title">{title}</Title> : null}
    </Box>
  );
}

export function GameTooltip({
  tip,
  variant = 'popover',
  inline = false,
  id,
  popover,
  locale,
  hint,
  ariaLabel,
  shinyLabel = 'Shiny',
  orLabel,
  className,
}: GameTooltipProps) {
  const tags = inline ? INLINE_TAGS : BLOCK_TAGS;
  const Panel = tags.div;
  const Divider = tags.div;
  const Footer = tags.p;
  const Day = tags.p;

  const chart = tip.width === 200;
  // The strip belongs to the panel that Shift can pin. The sheet of a detail page is
  // already fixed (7.5.9) and the compact day tooltip of the chart has no strip at all.
  const footer = variant === 'popover' && !chart && hint !== undefined;
  // `<details>` is flow content and may not sit inside a phrasing-only panel (7.5.2).
  const sections = inline ? [] : (tip.sections ?? []);
  // The constructors of 7.5.3 only emit rows that have a value; a row that arrives
  // empty or with the dash is dropped here instead of printing "—" (X13/T32).
  const rows = tip.rows.filter((row) => shows(row.value));
  const market = (tip.market ?? []).filter((row) => shows(row.value));

  const classes = ['ac-game-tooltip'];
  if (tip.width !== 282) classes.push(`ac-game-tooltip--w${tip.width}`);
  if (!footer && !chart) classes.push('ac-game-tooltip--static');
  // The popover replays its 150 ms entry every time it is shown, because the browser
  // takes it out of `display: none` (7.5.4). The sheet of a detail page never animates.
  if (variant === 'popover') classes.push('ac-game-tooltip--animate');
  if (className) classes.push(className);

  return (
    <Panel
      id={id}
      className={classes.join(' ')}
      popover={popover}
      role={variant === 'sheet' ? 'group' : 'tooltip'}
      aria-label={variant === 'sheet' ? ariaLabel : undefined}
    >
      {tip.head.type === 'none' ? null : (
        <Head
          head={tip.head}
          title={tip.title}
          shiny={tip.shiny === true}
          shinyLabel={shinyLabel}
          tags={tags}
        />
      )}
      {/* Day of the Guild chart: «Viernes 18/09, en curso» over its figures (7.5.2). */}
      {tip.dayTitle ? <Day className="ac-game-tooltip__day">{tip.dayTitle}</Day> : null}
      <Rows rows={rows} grid={tip.grid === true} tags={tags} locale={locale} orLabel={orLabel} />
      {sections.map((section, index) => (
        <Section key={index} section={section} first={index === 0} locale={locale} />
      ))}
      {market.length > 0 ? (
        <>
          <Divider role="none" className="ac-game-tooltip__divider" />
          <Rows rows={market} grid tags={tags} locale={locale} orLabel={orLabel} />
        </>
      ) : null}
      {footer ? (
        <Footer
          className={
            sections.length > 0 && market.length === 0
              ? 'ac-game-tooltip__footer ac-game-tooltip__footer--tight'
              : 'ac-game-tooltip__footer'
          }
        >
          {hint}
        </Footer>
      ) : null}
    </Panel>
  );
}
