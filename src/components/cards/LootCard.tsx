import type { HTMLAttributes, ReactNode } from 'react';

import { Card, Head, Title } from '@/components/cards/Card';
import type { CardHeadingLevel } from '@/components/cards/Card';
import { FactList } from '@/components/cards/FactList';
import type { FactMode, FactRow } from '@/components/cards/FactList';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { NestedEntity } from '@/components/game/NestedEntity';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import type { Locale } from '@/i18n/config';
import { lootValues, trackCount } from '@/lib/cards/layout';
import type { LootKey } from '@/lib/cards/layout';
import { formatInteger } from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';

// LootCard (spec 7.2.6, 7.5.5, 7.6.2, 7.6.4, 8.3, 8.4.2, 8.5; CARD_GRID_SYSTEM §6.3;
// DS:LootCard, DS:guias/30): the card of a drop or an item — its 40 slot with the sprite at
// 1x and the name on up to two lines, then one fact per key of the grid, values of up to two
// lines — built on the card kit of `Card.tsx`, inside `CardGrid family="loot"`: the drops of
// a Pokémon (8.3), the items of a system (8.4.2) and the items of a Market category (8.5).
//
// Markup and classes are the reference's (`bundle.js` LootCard). What the site does
// differently:
//
//   - `keys` is required (7.2.6): `lootKeys` of the drops the grid shows, the same list for
//     every card of it (7.6.3), so the card spans `trackCount('loot', keys)` tracks. The keys
//     are ids (src/lib/cards/layout.ts) and `labels` gives the visible label of each one
//     (DP1): `ui.tooltip` already has all of them but «Cantidad». `shopPrice` («Precio de
//     tienda», 8.5) is a key the reference does not have.
//   - Values (DS:LootCard «Qué aporta quien lo usa»). «Drop de» is text («44 Pokémon») or one
//     Pokémon, `{ name, href, tip }`, which opens its Pokédex panel; «Elemento» is the
//     element as `ElementChip` takes it, which opens the element panel, or text; «Uso» is
//     text; «Cantidad» arrives written («1 a 3»; a number is grouped); Precio NPC and Precio
//     de tienda are Pokédólares in whole units, drawn by `PokedolaresAmount` with its sprite
//     (S8). A value the drop does not have while another drop of the grid does is «—».
//     R2: an entity whose panel has nothing below its title is plain text (8.0.5).
//   - The panels of the facts open `down` lined up with the right edge of their value
//     (7.5.5), which sits at the right of its row. There is no `side` and no `compact`
//     (7.6.4): under 240 of grid the compact anatomy — padding 12 and the head centred in
//     card.css, the facts label over value in loot-card.css — comes from container queries
//     with the same DOM, and there the values sit at the left, so loot-card.css turns the
//     alignment of their panels to `start` through `--ac-tt-align`, which the controller
//     reads before the attribute (7.6.4).
//   - `loading` is the `lazy` of 7.4.2 for a card from index 4 of its list on.
//
// The card is not a link and never opens a tooltip: its title is the link (items have no
// page in this cut, §15, so theirs is text) and the entities of its facts are the triggers
// (7.5.10).

/** One Pokémon as the «Drop de» of a drop, with its Pokédex panel (`pokemonTip`, 7.5.3). */
export interface LootCardEntity {
  name: string;
  /** Page of the Pokémon; without it the trigger is a button (7.5.7). */
  href?: string;
  /** Its panel. `null`, or nothing below its title: plain text (R2). */
  tip: TipData | null;
}

/** A drop or an item, its values already read from the registries (§3.13, 8.3, 8.5). */
export interface LootCardDrop {
  /** Name of the item, the title of the card. */
  name: string;
  /** Page of the item. Items have none in this cut (§15): the title is text. */
  href?: string;
  /** Sprite as the adapter resolves it (DP2); `null` draws the missing mark (7.4.4). */
  sprite: SpriteProps | null;
  /** «Drop de»: «44 Pokémon», or the one Pokémon that drops it. */
  dropDe?: string | LootCardEntity | null;
  /** «Elemento». */
  element?: ElementChipEntry | string | null;
  /** «Uso». */
  use?: string | null;
  /** «Cantidad», written by the page from `drops[].cantidad` («2», «1 a 3»). */
  qty?: string | number | null;
  /** «Precio NPC»: `precioNpc.vende`, Pokédólares in whole units (S8). */
  npcPrice?: number | null;
  /** «Precio de tienda»: `precioNpc.compra`, Pokédólares in whole units (8.5). */
  shopPrice?: number | null;
  /** Language of «Uso» when it only exists in the other locale (8.0.5, T22). */
  useLang?: string;
}

export interface LootCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  drop: LootCardDrop;
  /** `lootKeys` of the drops of the grid: the same list for every card of it (7.6.3). */
  keys: readonly LootKey[];
  /** Visible label of each key («Drop de», «Elemento»…): `ui.tooltip` plus «Cantidad». */
  labels: Readonly<Record<LootKey, string>>;
  /** Picks the format of the figures, here and in the panels (C-R3). */
  locale: Locale;
  /** Strip of the panels, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Level of the title, when the card cannot see the one of its grid (7.6.2). */
  headingLevel?: CardHeadingLevel;
  /** `lazy` for a card from index 4 of its list on (7.4.2). */
  loading?: 'lazy' | 'eager';
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData | null | undefined): tip is TipData {
  if (!tip) return false;
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

function isElement(value: unknown): value is ElementChipEntry {
  return typeof value === 'object' && value !== null && 'id' in value && 'tip' in value;
}

function isEntity(value: unknown): value is LootCardEntity {
  return typeof value === 'object' && value !== null && 'name' in value && 'tip' in value;
}

export function LootCard({
  drop,
  keys,
  labels,
  locale,
  hint,
  headingLevel,
  loading,
  className,
  ...rest
}: LootCardProps) {
  const values = lootValues(drop);

  const fact = (key: LootKey): FactRow => {
    const value = values[key];
    let shown: ReactNode = null;
    let mode: FactMode = 'wrap';
    let lang: string | undefined;
    let target = false;
    if (!present(value)) {
      shown = null;
    } else if (key === 'npcPrice' || key === 'shopPrice') {
      shown =
        typeof value === 'number' ? <PokedolaresAmount amount={value} locale={locale} /> : null;
      mode = 'node';
    } else if (key === 'element' && isElement(value)) {
      shown = (
        <ElementChip
          element={value}
          variant="link"
          placement="down"
          align="end"
          locale={locale}
          hint={hint}
        />
      );
      mode = 'node';
      target = value.tip.rows.length > 0;
    } else if (key === 'droppedBy' && isEntity(value)) {
      if (hasContent(value.tip)) {
        shown = (
          <NestedEntity
            tip={value.tip}
            href={value.href}
            variant="link"
            placement="down"
            align="end"
            locale={locale}
            hint={hint}
          >
            {value.name}
          </NestedEntity>
        );
        mode = 'node';
        target = true;
      } else {
        shown = value.name;
      }
    } else if (typeof value === 'number') {
      shown = formatInteger(value, locale);
    } else if (typeof value === 'string') {
      shown = value;
      if (key === 'use') lang = drop.useLang;
    }
    return { key, label: labels[key], value: shown, mode, lang, target };
  };
  const rows = keys.map(fact);

  const head = (
    <Head
      stage={
        <SpriteStage
          sprite={drop.sprite ? { ...drop.sprite, loading } : null}
          size={40}
          tone="primary"
        />
      }
      title={
        <Title href={drop.href} clamp={2}>
          {drop.name}
        </Title>
      }
    />
  );

  return (
    <Card
      {...rest}
      anat="loot"
      span={trackCount('loot', keys)}
      headingLevel={headingLevel}
      className={classes('ac-loot-card', className)}
    >
      {head}
      {rows.length > 0 ? <FactList rows={rows} /> : null}
    </Card>
  );
}
