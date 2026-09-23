import { Fragment } from 'react';

import { Glyph } from '@/components/icons/Glyph';
import { ContactChip } from '@/components/money/ContactChip';
import { PlusN } from '@/components/money/PlusN';
import type { PlusNAlign, PlusNPlacement } from '@/components/money/PlusN';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';

// ChipRow (spec 7.2.5, 7.5.8, 9.5.8; DS:ChipRow, DS:guias/40 §Comercio): the verified
// contact channels of a seller on one line, up to a cap. With more channels than the cap it
// shows cap − 1 chips and a «+N» that lists the rest, so every channel can be read and the
// line never wraps to a second row (DS:ChipRow §No hacer).
//
// Markup of the reference (`bundle.js` ChipRow): a `ul` of `ContactChip`s, the «+N» in the
// last `li` (`--more`). The «+N» is `PlusN`, whose list the delegated controller of 7.5.8
// opens on click, touch, hover and focus; it opens `up` + `start` by default, the `up-left`
// of the reference. Each hidden channel keeps its check in that list.
//
// The name of the «+N» button says what it hides — «2 canales más: Correo, Teléfono +1» —
// from `ui.money.moreChannels` of the page's locale (DP1), in singular and plural, with the
// count grouped by `formatInteger` and the names joined by commas (13.3). The chips never
// open a tooltip (7.5.10).

/** A channel: its label, or its label and whether it carries the check (default true). */
export type ChipRowItem = string | { label: string; verified?: boolean };

/** The name of the «+N» button, `ui.money` of the dictionary. */
export interface ChipRowLabels {
  /** «{n} canales más: {names}» / «{n} more channels: {names}». */
  moreChannels: MessageLeaf;
}

export interface ChipRowProps {
  /** The channels in the seller's order, already in the page's language. */
  items: readonly ChipRowItem[];
  /** Chips on the line before «+N». Default 3 (the listing card, 9.5.8). */
  cap?: number;
  labels: ChipRowLabels;
  /** Picks the plural form and the grouping of the count (C-R3). */
  locale: Locale;
  /** Where the list of «+N» opens (7.5.5). */
  placement?: PlusNPlacement;
  align?: PlusNAlign;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

interface Channel {
  label: string;
  verified: boolean;
}

function channel(item: ChipRowItem): Channel {
  return typeof item === 'string'
    ? { label: item, verified: true }
    : { label: item.label, verified: item.verified !== false };
}

/** «2 canales más: Correo, Teléfono +1»: the count and the names of what «+N» hides. */
function moreLabel(hidden: readonly Channel[], labels: ChipRowLabels, locale: Locale): string {
  const template = isPluralMessage(labels.moreChannels)
    ? plural(locale, hidden.length, labels.moreChannels)
    : labels.moreChannels;
  return fill(template, {
    n: formatInteger(hidden.length, locale),
    names: hidden.map((entry) => entry.label).join(', '),
  });
}

export function ChipRow({
  items,
  cap = 3,
  labels,
  locale,
  placement = 'up',
  align = 'start',
  className,
}: ChipRowProps) {
  const limit = Math.max(1, Math.trunc(cap));
  const channels = items.map(channel);
  const over = channels.length > limit;
  const shown = over ? channels.slice(0, limit - 1) : channels;
  const hidden = over ? channels.slice(limit - 1) : [];

  return (
    <ul className={className ? `ac-chip-row ${className}` : 'ac-chip-row'}>
      {shown.map((entry, index) => (
        // The channels are the seller's fixed sequence, so their position is their identity.
        <li key={index} className="ac-chip-row__item">
          <ContactChip label={entry.label} verified={entry.verified} />
        </li>
      ))}
      {over ? (
        <li className="ac-chip-row__item ac-chip-row__item--more">
          <PlusN
            label={moreLabel(hidden, labels, locale)}
            placement={placement}
            align={align}
            items={hidden.map((entry, index) => (
              <Fragment key={index}>
                {entry.label}
                {entry.verified ? (
                  <Glyph name="check" size={12} className="ac-chip-row__check" />
                ) : null}
              </Fragment>
            ))}
          />
        </li>
      ) : null}
    </ul>
  );
}
