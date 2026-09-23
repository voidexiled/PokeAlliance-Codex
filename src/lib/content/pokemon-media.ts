const POKEMON_MEDIA_ORIGIN = 'https://wiki.pokealliance.com';

export function resolvePokemonImage(source: string | null | undefined): string | null {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return source;
  return `${POKEMON_MEDIA_ORIGIN}/${source.replace(/^\/+/, '')}`;
}
