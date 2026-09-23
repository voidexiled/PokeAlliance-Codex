// Client-safe Pokémon roster for a React island that needs every variant in the browser, such
// as the Compare tool of spec §11. content/pokemon.json is validated by pnpm content:check and
// by repository.ts when the site builds, so an island reads the file directly and does not
// bundle Zod. The roster carries data only (§11.7): numbers, tiers, roles, variants and element
// names are written for the interface by src/lib/format/, the dictionaries and
// content/elementos.json, never here.
import pokemonData from '../../../content/pokemon.json';
import type { PokemonRecord } from '@/lib/content/types';

export type RosterPokemon = PokemonRecord;

export const pokemonRoster: RosterPokemon[] = pokemonData.pokemon;
