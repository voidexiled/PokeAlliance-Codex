import type { ReactNode } from 'react';

import type { PanelProvider } from './model';

// The provider marks of the account page (owner decision, Cuenta-panel.dc.html): Discord is its
// white mark on #5865F2, Google its untouched multicolour G on white (a tile) or on the dark
// neutral button «Continuar con Google», Twitch its glitch. The files are the brand SVGs under
// public/brand/; each tile is decorative (`aria-hidden`), the provider's name is always text.

const LOGOS: Record<PanelProvider, string> = {
  discord: '/brand/discord-mark-white.svg',
  google: '/brand/google-g.svg',
  twitch: '/brand/twitch-glitch-purple.svg',
};

export type TileSize = 'xs' | 'sm' | 'md' | 'lg';

/** A 20, 24, 32 or 40 px tile with the provider's mark. */
export function ProviderTile({ provider, size }: { provider: PanelProvider; size: TileSize }) {
  return (
    <span
      aria-hidden="true"
      className={`ac-panel-tile ac-panel-tile--${size} ac-panel-tile--${provider}`}
    >
      <img className="ac-panel-tile__logo" src={LOGOS[provider]} alt="" decoding="async" />
    </span>
  );
}

/** A neutral tile with a character, for a channel without a brand mark (correo, otra plataforma). */
export function LetterTile({ letter, size }: { letter: string; size: TileSize }) {
  return (
    <span aria-hidden="true" className={`ac-panel-tile ac-panel-tile--${size}`}>
      {letter}
    </span>
  );
}

interface ProviderButtonProps {
  provider: 'discord' | 'google';
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

/** «Vincular Discord» (#5865F2, white mark) or «Continuar con Google» (dark, multicolour G). */
export function ProviderButton({ provider, onClick, disabled, children }: ProviderButtonProps) {
  return (
    <button
      type="button"
      className={`ac-panel-button ac-panel-button--${provider}`}
      onClick={onClick}
      disabled={disabled}
    >
      <img
        className={`ac-panel-button__logo ac-panel-button__logo--${provider}`}
        src={LOGOS[provider]}
        alt=""
        decoding="async"
      />
      {children}
    </button>
  );
}
