// Updates content/pokemon.json from the PokeAlliance wiki roster.
//
// Usage:
//   node scripts/content/import-roster.mjs [--file roster.json] [--overwrite] [--dry-run]
//
// By default the import only adds Pokémon that are not in content/pokemon.json yet and
// fills fields that are still null; values edited by hand are kept. --overwrite replaces
// every imported field. Records are never removed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatJson } from './lib/format-json.mjs';

const ROSTER_URL = 'https://wiki.pokealliance.com/api/pokemon';
const root = fileURLToPath(new URL('../../', import.meta.url));
const target = path.join(root, 'content', 'pokemon.json');

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const file = fileIndex === -1 ? null : args[fileIndex + 1];
const overwrite = args.includes('--overwrite');
const dryRun = args.includes('--dry-run');

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toRecord(raw) {
  const tier = raw.displayTier ?? raw.tier;
  return {
    id: slugify(String(raw.name)),
    nombre: String(raw.name),
    numero: toInteger(raw.number),
    generacion: toInteger(raw.generation),
    variante: raw.variant || 'normal',
    nivel: typeof raw.level === 'number' ? raw.level : null,
    tier: tier === '' || tier === undefined ? null : tier,
    funcion: raw.role?.trim() || null,
    elementos: (raw.elements ?? []).map((element) => element.name),
    imagen: raw.image || null,
  };
}

async function loadRoster() {
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const response = await fetch(ROSTER_URL);
  if (!response.ok) throw new Error(`${ROSTER_URL} respondió ${response.status}`);
  return response.json();
}

const payload = await loadRoster();
const incoming = (
  Array.isArray(payload) ? payload : (payload.pokemon ?? payload.records ?? [])
).map(toRecord);
if (incoming.length === 0) throw new Error('El roster no trae Pokémon.');
if (incoming.some((record) => !record.id)) throw new Error('Hay un Pokémon sin nombre.');

const current = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')).pokemon : [];
const byId = new Map(current.map((record) => [record.id, record]));
let added = 0;
let updated = 0;

for (const record of incoming) {
  const existing = byId.get(record.id);
  if (!existing) {
    byId.set(record.id, record);
    added++;
    continue;
  }
  let changed = false;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'id') continue;
    const keep = !overwrite && existing[key] !== null && existing[key] !== undefined;
    if (keep || JSON.stringify(existing[key]) === JSON.stringify(value)) continue;
    existing[key] = value;
    changed = true;
  }
  if (changed) updated++;
}

console.log(`${incoming.length} en el roster · ${added} nuevos · ${updated} actualizados`);
if (!dryRun) {
  const output = { $schema: './schemas/pokemon.schema.json', pokemon: [...byId.values()] };
  fs.writeFileSync(target, formatJson(output));
  console.log(`Escrito ${path.relative(root, target)}. Revísalo con pnpm content:check.`);
}
