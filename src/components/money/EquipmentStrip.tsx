import { EntitySlot } from '@/components/game/EntitySlot';
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import type { PokemonTier } from '@/lib/content/types';
import type { TipData } from '@/lib/game/tips';

// EquipmentStrip (spec 16.4.5): the equipment of a listed Pokémon — ball, auras, addons, held X,
// held Y and Mega Stone, in the order of the game — as a row of 32 px `EntitySlot`s without
// names. Each slot opens its own game tooltip; a held item carries its tier as the mini badge.
// Only what the Pokémon carries is drawn: no empty slot pads the row.

/** One piece of equipment, already resolved by the adapter (DP2). */
export interface EquipmentStripItem {
  /** Registry id: the React key (the name when absent). */
  id?: string;
  /** Canonical name: the accessible name of the slot. */
  name: string;
  sprite: SpriteProps | null;
  /** Its panel, built by a constructor of `src/lib/game/tips.ts`. */
  tip?: TipData;
  /** Tier of a held item: the mini badge of the slot. */
  tier?: PokemonTier | null;
  href?: string;
}

export interface EquipmentStripProps {
  items: readonly EquipmentStripItem[];
  locale: Locale;
  /** «Equipo» / «Equipment»: the accessible name of the list. */
  label: string;
  /** `ui.pinHint` of the panels. */
  hint: string;
  orLabel?: string;
  className?: string;
}

export function EquipmentStrip({
  items,
  locale,
  label,
  hint,
  orLabel,
  className,
}: EquipmentStripProps) {
  if (items.length === 0) return null;
  return (
    <ul
      className={className ? `ac-equipment-strip ${className}` : 'ac-equipment-strip'}
      aria-label={label}
    >
      {items.map((item, index) => (
        <li key={`${item.id ?? item.name}-${index}`}>
          <EntitySlot
            size={32}
            locale={locale}
            name={item.name}
            sprite={item.sprite}
            tip={item.tip}
            tier={item.tier ?? null}
            href={item.href}
            hint={hint}
            orLabel={orLabel}
          />
        </li>
      ))}
    </ul>
  );
}
