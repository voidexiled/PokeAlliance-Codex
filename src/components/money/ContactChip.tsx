import { Glyph } from '@/components/icons/Glyph';

// ContactChip (spec 7.2.5, 9.5.8, R6, R13; DS:ContactChip, DS:guias/40 §Comercio): one
// verified contact channel of a seller as a chip with its check — «Discord», «Correo»,
// «Teléfono +55». A phone always carries its full country code and never its number
// (R13): the label is composed by whoever reads the channel, never here.
//
// «Contacto verificado» is a function of the product, not a provenance mark (R6): the
// check says the seller verified the channel. It is `text-tertiary` and never green
// (DS:ContactChip §No hacer), a 12 px `Glyph` at stroke 2.5 (C-R7), decorative: the row
// label «Contacto verificado» names what the chips are.
//
// The chip is text: no link, no button and no tooltip (7.5.10). On a line that runs out of
// room it shrinks and its label ends in «…» before the line can overflow; the check stays.

export interface ContactChipProps {
  /** Name of the channel, already in the page's language: «Correo», «Teléfono +55». */
  label: string;
  /** Draws the check (default). */
  verified?: boolean;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function ContactChip({ label, verified = true, className }: ContactChipProps) {
  return (
    <span className={className ? `ac-contact-chip ${className}` : 'ac-contact-chip'}>
      <span className="ac-contact-chip__label">{label}</span>
      {verified ? <Glyph name="check" size={12} className="ac-contact-chip__check" /> : null}
    </span>
  );
}
