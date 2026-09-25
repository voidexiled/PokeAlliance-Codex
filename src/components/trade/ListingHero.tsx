import type { ReactNode } from 'react';

import type { ListingCardEntity, ListingFactValue } from '@/components/cards/ListingCard';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { NestedEntity } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { TierBadge } from '@/components/game/TierBadge';
import { DiamondsAmount } from '@/components/money/DiamondsAmount';
import { EquipmentStrip } from '@/components/money/EquipmentStrip';
import type { EquipmentStripItem } from '@/components/money/EquipmentStrip';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import type { Locale } from '@/i18n/config';
import type { PokemonTier } from '@/lib/content/types';
import { formatInteger } from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';

// The listing page, board Anuncio-detalle «Variante 1» (owner decision 2026-09-24): the hero —
// the art in its frame, the title, «{Mundo} · Publicado el {fecha}» and the facts in a grid of
// label over value — and the «Equipo» panel of slots: Ball, Auras, Addons, Held X and Held Y
// with their tier, and Mega Stone, «Ninguno» / «Ninguna» when empty. Both are rendered on the
// server; the entities inside open their panels through the tooltip controller of the page.

/** One fact of the hero: its label and its value as the card reads it. */
export interface HeroFact {
  key: string;
  label: string;
  value: ListingFactValue | ReactNode;
  /** How the value draws: text (default), the money of a quantity, a tier, the stars. */
  kind?: 'text' | 'pokedolares' | 'diamonds' | 'tier' | 'stars';
}

export interface ListingHeroProps {
  /** «Ficha de {name}»: the name of the hero's region. */
  label: string;
  title: ReactNode;
  meta: ReactNode;
  /** Tags under the meta: «Dinero real», «Cualquier mundo». */
  tags?: ReactNode;
  /** The art of a Pokémon (smooth), or the 2x sprite of an item, Diamonds or Pokédólares. */
  art: SpriteProps | null;
  pokemon: boolean;
  qty?: number | null;
  facts: readonly HeroFact[];
  locale: Locale;
  hint: string;
  shinyLabel: string;
  orLabel: string;
  /** «Star Level {n} de 5» for the stars. */
  starsLabel?: (n: number) => string;
  /**
   * Panel of the traded item or Pokémon (`assetPanel`), opened by the art: every fact of the
   * entity, what the hero's facts leave out included (owner rule 2026-09-25).
   */
  tip?: TipData | null;
  /** The game's text of the traded item (what it does), under the meta; `lang` when it differs. */
  text?: { value: string; lang?: string } | null;
}

function isElement(value: unknown): value is ElementChipEntry {
  return typeof value === 'object' && value !== null && 'id' in value && 'icon' in value;
}

function isEntity(value: unknown): value is ListingCardEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'name' in value &&
    'tip' in value
  );
}

function hasTip(tip: TipData | null | undefined): tip is TipData {
  return Boolean(tip && (tip.rows.length > 0 || tip.sections?.length || tip.market?.length));
}

const STARS = 5;

export function ListingHero(props: ListingHeroProps) {
  const { locale, hint, shinyLabel, orLabel } = props;

  const value = (fact: HeroFact): ReactNode => {
    const raw = fact.value;
    if (
      raw === null ||
      raw === undefined ||
      (typeof raw === 'string' && !present(raw)) ||
      (Array.isArray(raw) && raw.length === 0)
    ) {
      return null;
    }
    if (fact.kind === 'pokedolares' && typeof raw === 'number') {
      return <PokedolaresAmount amount={raw} locale={locale} />;
    }
    if (fact.kind === 'diamonds' && typeof raw === 'number') {
      return <DiamondsAmount amount={raw} word={false} locale={locale} />;
    }
    if (fact.kind === 'tier') {
      return <TierBadge tier={raw as PokemonTier} />;
    }
    if (fact.kind === 'stars' && typeof raw === 'number') {
      return (
        <span className="ac-listing-hero__stars">
          <span aria-hidden="true">
            {Array.from({ length: STARS }, (_, index) => (
              <span key={index} data-on={index < raw ? '' : undefined}>
                {index < raw ? '★' : '☆'}
              </span>
            ))}
          </span>
          <span className="sr-only">{props.starsLabel?.(raw) ?? formatInteger(raw, locale)}</span>
        </span>
      );
    }
    if (typeof raw === 'number') return formatInteger(raw, locale);
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && raw.every(isElement)) {
      return (
        <span className="ac-listing-hero__els">
          {raw.map((element: ElementChipEntry) => (
            <ElementChip
              key={element.id}
              element={element}
              variant="link"
              placement="down"
              align="start"
              locale={locale}
              hint={hint}
            />
          ))}
        </span>
      );
    }
    if (isElement(raw)) {
      return (
        <ElementChip
          element={raw}
          variant="link"
          placement="down"
          align="start"
          locale={locale}
          hint={hint}
        />
      );
    }
    if (isEntity(raw)) {
      const content = (
        <>
          {raw.sprite ? <Sprite {...raw.sprite} alt="" /> : null}
          {raw.name}
        </>
      );
      return hasTip(raw.tip) ? (
        <NestedEntity
          tip={raw.tip}
          href={raw.href}
          variant="link"
          placement="down"
          align="start"
          locale={locale}
          hint={hint}
          shinyLabel={shinyLabel}
          orLabel={orLabel}
        >
          {content}
        </NestedEntity>
      ) : (
        raw.name
      );
    }
    if (Array.isArray(raw)) {
      return raw.filter((entry): entry is string => typeof entry === 'string').join(', ');
    }
    return raw as ReactNode;
  };

  const shown = props.facts.flatMap((fact) => {
    const drawn = value(fact);
    return drawn === null ? [] : [{ fact, drawn }];
  });

  const artNode = props.pokemon ? (
    props.art === null ? null : (
      <Sprite {...props.art} smooth alt="" />
    )
  ) : (
    <SpriteStage
      sprite={props.art}
      size={72}
      qty={
        typeof props.qty === 'number' && props.qty > 1
          ? formatInteger(props.qty, locale)
          : undefined
      }
    />
  );

  return (
    <section className="ac-listing-hero" aria-label={props.label}>
      <div className="ac-listing-hero__art" data-pokemon={props.pokemon ? '' : undefined}>
        {hasTip(props.tip) ? (
          <NestedEntity
            tip={props.tip}
            variant="plain"
            placement="side"
            align="start"
            ariaLabel={props.tip.title}
            locale={locale}
            hint={hint}
            shinyLabel={shinyLabel}
            orLabel={orLabel}
            wrapperClassName="ac-listing-hero__tip"
            className="ac-listing-hero__trigger"
          >
            {artNode}
          </NestedEntity>
        ) : (
          artNode
        )}
      </div>
      <div className="ac-listing-hero__main">
        <h1 className="ac-listing-hero__title">{props.title}</h1>
        <p className="ac-listing-hero__meta">{props.meta}</p>
        {props.text ? (
          <p className="ac-listing-hero__text" lang={props.text.lang}>
            {props.text.value}
          </p>
        ) : null}
        {props.tags ? <p className="ac-listing-hero__tags">{props.tags}</p> : null}
        {shown.length > 0 ? (
          <dl className="ac-listing-hero__facts">
            {shown.map(({ fact, drawn }) => (
              <div key={fact.key} className="ac-listing-hero__fact">
                <dt>{fact.label}</dt>
                <dd>{drawn}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------ equipment

/**
 * One group of the «Equipo» panel: its label and its slots. The page passes only the kinds the
 * Pokémon carries (owner rule 2026-09-25): an empty group is not drawn.
 */
export interface EquipmentGroup {
  key: string;
  label: string;
  items: readonly EquipmentStripItem[];
  /** Show the name beside a single slot (Ball, Held X, Held Y, Mega Stone). */
  named?: boolean;
  /** Takes the whole row (Auras). */
  wide?: boolean;
}

export interface ListingEquipmentProps {
  title: string;
  groups: readonly EquipmentGroup[];
  locale: Locale;
  hint: string;
  orLabel: string;
}

export function ListingEquipment({ title, groups, locale, hint, orLabel }: ListingEquipmentProps) {
  return (
    <section className="ac-listing-equipment" aria-label={title}>
      <h2 className="ac-listing-equipment__title">{title}</h2>
      <div className="ac-listing-equipment__groups">
        {groups.map((group) => (
          <div
            key={group.key}
            className="ac-listing-equipment__group"
            data-wide={group.wide ? '' : undefined}
          >
            <p className="ac-listing-equipment__label">{group.label}</p>
            <div className="ac-listing-equipment__slots">
              <EquipmentStrip
                items={group.items}
                locale={locale}
                label={group.label}
                hint={hint}
                orLabel={orLabel}
              />
              {group.named && group.items.length === 1 ? (
                <span className="ac-listing-equipment__name">{group.items[0].name}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
