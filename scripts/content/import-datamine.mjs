// Imports the owner's client export (the `run_*` folders of the game_datamine module) into
// content/: Pokémon (Pokédex detail), moves, and the items of the Market catalog with their
// inspection text, NPC prices and ways to get them. Rules and shapes: scripts/content/lib/datamine.mjs.
//
// Usage:
//   pnpm content:datamine <datamine folder | run folder> [--write] [--sobrescribir campo,campo]
//                         [--informe archivo.md]
//
// Dry run by default: it prints what it would change and writes nothing. --write applies it.
// A field that already has a value is kept (and listed as a difference) unless --sobrescribir
// names it. Records are never removed. Running it twice changes nothing the second time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyExport, readExport } from './lib/datamine.mjs';
import { formatJson } from './lib/format-json.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const contentDir = path.join(root, 'content');

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
};
const write = args.includes('--write');
const overwrite = new Set((option('--sobrescribir') ?? '').split(',').filter(Boolean));
const reportFile = option('--informe');
const input = args.find(
  (arg, index) =>
    !arg.startsWith('--') && !['--sobrescribir', '--informe'].includes(args[index - 1]),
);
if (!input) {
  console.error(
    'Uso: pnpm content:datamine <carpeta datamine> [--write] [--sobrescribir campo,campo] [--informe archivo.md]',
  );
  process.exit(1);
}
if (reportFile && path.resolve(reportFile).startsWith(path.resolve(contentDir) + path.sep)) {
  console.error('El informe no puede ir dentro de content/.');
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const pokemonFile = path.join(contentDir, 'pokemon.json');
const movesFile = path.join(contentDir, 'moves.json');
const itemsDir = path.join(contentDir, 'items');
const pokemonData = readJson(pokemonFile);
const movesData = readJson(movesFile);
const itemFiles = fs
  .readdirSync(itemsDir)
  .filter((name) => name.endsWith('.json') && name !== 'categorias.json');
const itemData = Object.fromEntries(
  itemFiles.map((name) => [path.basename(name, '.json'), readJson(path.join(itemsDir, name))]),
);
const elements = readJson(path.join(contentDir, 'elementos.json')).elementos.map((e) => e.id);
const quests = readJson(path.join(contentDir, 'quests.json')).misiones ?? [];

const before = JSON.stringify({ pokemonData, movesData, itemData });

const { types, runs, summaryErrors } = readExport(path.resolve(input));
const content = {
  pokemon: pokemonData.pokemon,
  moves: movesData.movimientos,
  items: Object.fromEntries(Object.entries(itemData).map(([name, data]) => [name, data.items])),
  elements,
  quests,
};
const report = applyExport(types, content, { overwrite });

// ------------------------------------------------------------------------------ report

const lines = [];
const out = (line = '') => lines.push(line);
const list = (title, values, limit = 40) => {
  if (values.length === 0) return;
  out(`${title} (${values.length}):`);
  for (const value of values.slice(0, limit)) out(`  - ${value}`);
  if (values.length > limit)
    out(`  … y ${values.length - limit} más (--informe para la lista entera)`);
};
const counts = (map) => [...map].map(([field, count]) => `${field} ${count}`).join(', ') || 'nada';

out(
  `Exportación: ${runs.length} runs (${runs.join(', ')}); errores anotados en summary.json: ${summaryErrors}`,
);
out(
  `Leído: ${types.pokedex_detail.length} fichas de Pokédex, ${types.market_catalog.length} ítems del catálogo del Market, ` +
    `${types.items.length} inspecciones, ${types.npc_trade.length} filas de NPC, ${types.shop_items.length} de tiendas, ` +
    `${types.craft_recipes.length} recetas, ${types.pass_rewards.length} del pase, ${types.calendar_rewards.length} del calendario`,
);
out();
out(`content/pokemon.json: campos escritos — ${counts(report.changes.pokemon)}`);
out(
  `content/moves.json: ${report.created.moves.length} movimientos nuevos; campos escritos — ${counts(report.changes.moves)}`,
);
const createdBy = {};
for (const item of report.created.items)
  createdBy[item.categoria] = (createdBy[item.categoria] ?? 0) + 1;
out(
  `content/items/: ${report.created.items.length} ítems nuevos (${
    Object.entries(createdBy)
      .map(([c, n]) => `${c} ${n}`)
      .join(', ') || 'ninguno'
  }); campos escritos — ${counts(report.changes.items)}`,
);
out();
list('Fichas sin registro en content/pokemon.json (no se crean)', report.unmatchedPokemon);
list('Registros de content/pokemon.json sin ficha en la exportación', report.pokemonWithoutDetail);
list(
  'Ítems sin registro en content/items/ (sus drops, evoluciones y recetas se omiten)',
  [...report.missingItems.values()].map(
    (e) => `${e.clientId} ${e.name} [${[...e.uses].join(', ')}]`,
  ),
);
list('Pasos de evolución omitidos por ítems sin registro', report.skippedEvolutions);
list('Destinos de evolución sin registro', report.missingEvolutionTargets);
list('Recetas omitidas', report.skippedRecipes);
list(
  'Premios de ítems sin registro (tiendas, pase, calendario, tareas, recetas)',
  [...report.unresolvedRewards].map(([source, map]) => `${source}: ${map.size} ítems`),
);
list(
  'Elementos fuera del enum (no se escriben)',
  [...report.unknownElements].map(([e, n]) => `${e} ×${n}`),
);
list('Tiers con texto desconocido', report.oddTiers);
list('Pokémon con elementos de área mezclados (revisar elementoMoveset)', report.mixedMoveset);
list(
  'Movimientos que cambian según el Pokémon (moves.json guarda el valor más repetido; elemento, alcance y efectos distintos van en el movimiento de cada Pokémon; la descripción no)',
  report.moveConflicts,
);
list('Drops repetidos en una zona (se deja el primero)', report.duplicateDrops);
list(
  'Catálogo sin categoría conocida (no se crea)',
  report.catalogWithoutCategory.map((e) => `${e.clientId} ${e.name} (${e.category})`),
);
list(
  'Ítems cuya categoría del Market no es la de su archivo',
  report.catalogCategoryMismatch.map((e) => `${e.id}: archivo ${e.file}, Market ${e.market}`),
);
list(
  'Helds sin patrón «X-Efecto (Tier: n)» (no se crean)',
  report.heldsUnparsed.map((e) => `${e.clientId} ${e.name}`),
);
list(
  'Precio NPC distinto según la tienda (no se escribe)',
  report.npcPriceConflicts.map((e) => `${e.id}: ${JSON.stringify(e.prices)}`),
);
list(
  '«Price:» de la inspección distinto del NPC (gana el NPC)',
  report.npcInspectDisagree.map((e) => `${e.id}: NPC ${e.npc}, inspección ${e.inspect}`),
);
list(
  'Mega Stones',
  report.megaStones.map(
    (e) =>
      `${e.clientId} ${e.name} → ${e.pokemon ?? '¿?'}${e.item ? ` (ítem ${e.item})` : ' (sin registro)'}`,
  ),
  10,
);
list('Campos de la ficha que el importador no usa', [...report.extraDetailFields]);
out(
  `role de las fichas: ${[...report.roleValues].map(([v, n]) => `${v} ×${n}`).join(', ')} (0 = sin rol; no hay campo)`,
);
list(
  'Valores existentes que no se tocan (usa --sobrescribir campo)',
  report.differences.map(
    (d) =>
      `${d.kind} ${d.id} ${d.field}: ${JSON.stringify(d.current)} → ${JSON.stringify(d.incoming)}`,
  ),
  25,
);

const after = JSON.stringify({ pokemonData, movesData, itemData });
const changed = before !== after;
out();
if (!write)
  out(changed ? 'Simulación: no se escribió nada. Añade --write para aplicarlo.' : 'Sin cambios.');

if (write && changed) {
  fs.writeFileSync(pokemonFile, formatJson(pokemonData));
  fs.writeFileSync(movesFile, formatJson(movesData));
  for (const [name, data] of Object.entries(itemData)) {
    const file = path.join(itemsDir, `${name}.json`);
    const text = formatJson(data);
    if (fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
  }
  out('Escrito. Revísalo con pnpm content:check.');
} else if (write) out('Sin cambios: no se escribió nada.');

console.log(lines.join('\n'));

if (reportFile) {
  const full = [];
  const all = (title, values) => {
    if (values.length === 0) return;
    full.push(`## ${title} (${values.length})`, '', ...values.map((v) => `- ${v}`), '');
  };
  full.push('# Informe de pnpm content:datamine', '', '```', ...lines, '```', '');
  all('Fichas sin registro', report.unmatchedPokemon);
  all('Registros sin ficha', report.pokemonWithoutDetail);
  all(
    'Ítems sin registro',
    [...report.missingItems.values()].map(
      (e) => `${e.clientId} ${e.name} [${[...e.uses].join(', ')}]`,
    ),
  );
  all('Evoluciones omitidas', report.skippedEvolutions);
  all('Recetas omitidas', report.skippedRecipes);
  all('Elementos de área mezclados', report.mixedMoveset);
  all('Movimientos con valores distintos', report.moveConflicts);
  all(
    'Mega Stones',
    report.megaStones.map(
      (e) => `${e.clientId} ${e.name} → ${e.pokemon ?? '¿?'}${e.item ? ` (ítem ${e.item})` : ''}`,
    ),
  );
  all(
    'Diferencias',
    report.differences.map(
      (d) =>
        `${d.kind} ${d.id} ${d.field}: ${JSON.stringify(d.current)} → ${JSON.stringify(d.incoming)}`,
    ),
  );
  fs.writeFileSync(reportFile, full.join('\n'));
  console.log(`Informe: ${reportFile}`);
}
