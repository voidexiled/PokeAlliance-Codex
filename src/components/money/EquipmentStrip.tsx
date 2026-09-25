import { EntitySlot } from '@/components/game/EntitySlot';
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import type { TipData } from '@/lib/game/tips';

// EquipmentStrip (spec 16.4.5): one kind of equipment of a listed Pokémon — its Ball, its held
// items, its Mega Stone, its Auras or its Addons — as a row of 32 px `EntitySlot`s without
// names, wrapping on narrow boxes. Each slot opens its own game tooltip; no slot carries a
// tier mark (owner rule 2026-09-25): a held item's tier is in its name and its tooltip. The
// card and the listing page draw one strip per kind, each under its own label, so two kinds
// never share a row. Only what the Pokémon carries is drawn: no empty slot pads the row.

/** One piece of equipment, already resolved by the adapter (DP2). */
export interface EquipmentStripItem {
  /** Registry id: the React key (the name when absent). */
  id?: string;
  /** Canonical name: the accessible name of the slot. */
  name: string;
  sprite: SpriteProps | null;
  /** Its panel, built by a constructor of `src/lib/game/tips.ts`. */
  tip?: TipData;
  href?: string;
}

export interface EquipmentStripProps {
  items: readonly EquipmentStripItem[];
  locale: Locale;
  /** The kind («Ball», «Auras»…): the accessible name of the list. */
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
            href={item.href}
            hint={hint}
            orLabel={orLabel}
          />
        </li>
      ))}
    </ul>
  );
}
