// The two list islands of the Pokémon page (spec 8.3, 8.0.6): «Drops» and «Tier list». The
// page imports both from this one module, so the build writes them into one deferred chunk
// (13.6). Both share the list kit of the Pokédex island (EntityList, the cards, the tooltip);
// with one entry module for the page instead of two, that kit stays one chunk for the Pokédex
// as well, and the initial JS of `/{l}/pokedex/` keeps within its 110 KB instead of paying
// for the chunks that two separate entries split it into.
//
// The «Ítems» list of a system page (8.4.2 step 6, E16) shares the same kit, so the system
// page imports it from here too: as an entry of its own it split the Pokédex card out of the
// kit's chunk and put `/{l}/pokedex/` over its 110 KB (D-020).
export { DropsList } from './DropsList';
export { FamilyList } from './FamilyList';
export { SystemItemsList } from '@/components/systems/SystemItemsList';
