export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

export const localeCopy: Record<
  Locale,
  {
    skipToContent: string;
    navLabel: string;
    home: string;
    pokedex: string;
    guides: string;
    map: string;
    systems: string;
    rotations: string;
    sources: string;
    search: string;
    tools: string;
    changes: string;
    explore: string;
    community: string;
    language: string;
    status: string;
    publicFoundation: string;
  }
> = {
  es: {
    skipToContent: 'Saltar al contenido principal',
    navLabel: 'Navegación principal',
    home: 'Inicio',
    pokedex: 'Pokédex',
    guides: 'Guías',
    map: 'Mapa',
    systems: 'Sistemas',
    rotations: 'Rotaciones',
    sources: 'Fuentes',
    search: 'Buscar',
    tools: 'Herramientas',
    changes: 'Cambios',
    explore: 'Explorar',
    community: 'Comunidad',
    language: 'Idioma',
    status: 'Estado del proyecto',
    publicFoundation: 'Fundación pública',
  },
  en: {
    skipToContent: 'Skip to main content',
    navLabel: 'Main navigation',
    home: 'Home',
    pokedex: 'Pokédex',
    guides: 'Guides',
    map: 'Map',
    systems: 'Systems',
    rotations: 'Rotations',
    sources: 'Sources',
    search: 'Search',
    tools: 'Tools',
    changes: 'Changes',
    explore: 'Explore',
    community: 'Community',
    language: 'Language',
    status: 'Project status',
    publicFoundation: 'Public foundation',
  },
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocale(value: string | undefined): Locale {
  return value && isLocale(value) ? value : 'es';
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}
