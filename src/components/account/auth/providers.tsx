import type { ReactNode } from 'react';

import type { LinkProvider } from './shared';

// The provider buttons and tiles with the real marks (owner decision, public/brand/):
// - Discord: #5865F2 fill with the white mark;
// - Google: the dark neutral button of Google's guidelines with the untouched multicolour G;
// - Twitch: #9146FF fill with the white glitch mark (optional badge, PUBLIC_AUTH_TWITCH).
// The colours are the providers' own, in auth.css; the marks are decorative (`alt=""`): the
// text of the button names the provider.

const MARK: Readonly<Record<LinkProvider, { src: string; width: number; height: number }>> = {
  discord: { src: '/brand/discord-mark-white.svg', width: 22, height: 17 },
  google: { src: '/brand/google-g.svg', width: 18, height: 18 },
  twitch: { src: '/brand/twitch-glitch-white.svg', width: 18, height: 18 },
};

/** The marks on a dark neutral surface (outline buttons): Discord blurple, Twitch purple. */
const OUTLINE_SRC: Readonly<Record<LinkProvider, string>> = {
  discord: '/brand/discord-mark-blurple.svg',
  google: '/brand/google-g.svg',
  twitch: '/brand/twitch-glitch-purple.svg',
};

export function ProviderMark({
  provider,
  scale = 1,
  outline = false,
}: {
  provider: LinkProvider;
  scale?: number;
  outline?: boolean;
}) {
  const mark = MARK[provider];
  return (
    <img
      className="ac-auth-provider__mark"
      src={outline ? OUTLINE_SRC[provider] : mark.src}
      alt=""
      width={Math.round(mark.width * scale)}
      height={Math.round(mark.height * scale)}
      decoding="async"
    />
  );
}

export function ProviderButton({
  provider,
  children,
  onClick,
  disabled,
}: {
  provider: LinkProvider;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ac-auth-provider ac-auth-provider--${provider}`}
      onClick={onClick}
      disabled={disabled}
    >
      <ProviderMark provider={provider} />
      {children}
    </button>
  );
}

/** The square tile of a linked row: the mark on the provider's colour (white for Google). */
export function ProviderTile({
  provider,
  large = false,
}: {
  provider: LinkProvider;
  large?: boolean;
}) {
  return (
    <span
      className={`ac-auth-tile ac-auth-tile--${provider}${large ? ' ac-auth-tile--large' : ''}`}
      aria-hidden="true"
    >
      <ProviderMark provider={provider} scale={large ? 1.3 : 0.82} />
    </span>
  );
}
