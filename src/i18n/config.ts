export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

/** The default locale (§13.1): the root redirects to it, and it reads a path that names none. */
const [DEFAULT_LOCALE] = locales;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

/**
 * The locale of a `[locale]` route parameter. Every route under `[locale]` is generated for
 * `locales` alone (`getStaticPaths`, §8.0.1), so a value outside them never names a page of
 * the site, and this throws instead of falling back to `es`, which would render Spanish under
 * any prefix. A request for `/xx/…` never gets this far: the build has no page for it and it
 * lands on the 404 of §8.12, which picks its language with `getPathLocale`. The error only
 * surfaces a route that yields a locale the site does not have; a route rendered on demand
 * asks `isLocale` first and answers that 404.
 */
export function getLocale(value: string | undefined): Locale {
  if (value !== undefined && isLocale(value)) return value;
  throw new Error(
    `getLocale: «${value ?? ''}» is not a locale of the site (${locales.join(', ')}).`,
  );
}

/**
 * The locale of a request path, for the page that answers a path no route has (§8.12): the
 * locale its first segment names — `/en` and `/en/…` read `en` — and the default locale for
 * any other path, `/xx/…` included.
 */
export function getPathLocale(pathname: string): Locale {
  const [first] = pathname.split('/').filter((segment) => segment.length > 0);
  return first !== undefined && isLocale(first) ? first : DEFAULT_LOCALE;
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}

/**
 * The same route under `locale`, for the prerendered `hreflang` links and the
 * language menu (§13.1). A path with no locale prefix gets one.
 *
 * Query and hash are dropped on purpose: the prerendered link goes to the plain
 * route, and `src/scripts/popover-anchor.ts` adds `location.search` and
 * `location.hash` when the option is clicked.
 */
export function getAlternatePath(pathname: string, locale: Locale): string {
  const path = pathname.split('#')[0].split('?')[0];
  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length > 0 && isLocale(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  // A last segment with an extension is a file (`indice.json`), not a route.
  const trailingSlash = segments[segments.length - 1].includes('.') ? '' : '/';
  return `/${segments.join('/')}${trailingSlash}`;
}
