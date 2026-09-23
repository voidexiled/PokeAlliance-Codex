// Shapes of the owner-editable JSON under content/. Unknown values are null.

export type PokemonTier = number | string;

/** `Ref` of §3.13: an entity with its own registry. */
export type ContentRef = {
  tipo: 'pokemon' | 'item' | 'sistema' | 'actividad';
  id: string;
};

/** `EnlaceDato` of §3.13: a text, and the entity it opens when it has a registry. */
export type EnlaceDato = {
  texto: string;
  ref?: ContentRef;
};

/** One drop of a Pokémon: an item id of content/items/ and how many it drops. */
export type PokemonDrop = {
  item: string;
  cantidad: { min: number; max: number } | null;
};

/** One evolution out of a Pokémon: the id it evolves into, its level and its items. */
export type PokemonEvolution = {
  a: string;
  nivel: number | null;
  items: { item: string; cantidad: number }[];
};

export type PokemonRecord = {
  id: string;
  nombre: string;
  numero: number | null;
  generacion: number | null;
  variante: string;
  nivel: number | null;
  tier: PokemonTier | null;
  funcion: string | null;
  elementos: string[];
  imagen: string | null;
  // The optional fields of §3.13: while one is missing, its row or section is not drawn.
  hp?: number | null;
  experiencia?: number | null;
  drops?: PokemonDrop[];
  evolucion?: PokemonEvolution[];
  habilidades?: string[];
  donde?: { hunts: EnlaceDato[]; linkedTasks: EnlaceDato[]; equiposNpc: EnlaceDato[] };
  elementoMoveset?: string | null;
};

export type MoveRecord = {
  id: string;
  nombre: string;
  elemento: string | null;
  slot: string | null;
  cooldownSegundos: number | null;
  modo: string | null;
  pokemon: string[];
};

export type SystemItemRecord = {
  id: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  sistema: string | null;
};

export type TravelConnection = {
  modo: string;
  comando: string | null;
};

export type LocationRecord = {
  id: string;
  nombre: string;
  tipo: string | null;
  region: string | null;
  acceso: string[];
  viajes: TravelConnection[];
};

export type RotationRecord = {
  id: string;
  nombre: string;
  tipo: string | null;
  disponibilidad: string | null;
  condicion: string | null;
  excluye: string[];
  comparacion: string[];
};
