// The pure part of `pnpm content:datamine` (scripts/content/import-datamine.mjs): reading the
// owner's client export and turning it into the shapes of content/. Nothing here writes a file,
// so tests can feed it fixtures. The rules are docs of the importer plan (§0–§8) with the shapes
// the site reads (content/schemas/pokemon, moves, items); where they differ, the site wins.
//
// Nothing about the export itself reaches content/: no run names, dates, hashes or «imported
// from» fields (D-012). Market listings, prices and requests, the owner's own Pokémon
// (`pokemon_sell_prices`) and anything about his character are never read.

import fs from 'node:fs';
import path from 'node:path';

// ------------------------------------------------------------------------------ reading

/**
 * The key of each export type (plan §1): within a type the last line with a key wins, across
 * runs in name (= chronological) order and across the `.001`, `.002`… chunks of a run.
 */
export const EXPORT_KEYS = {
  pokedex_list: (r) => String(r.id),
  pokedex_detail: (r) => String(r.name),
  items: (r) => String(r.clientId),
  market_catalog: (r) => `${r.categoryId}:${r.clientId}:${r.id}`,
  npc_trade: (r) => `${r.clientId}:${r.buyPrice ?? 0}:${r.sellPrice ?? 0}`,
  megastones: (r) => `${r.itemId}:${r.getMegaStonesArg}`,
  movebar: (r) => String(r.pokemon),
  shop_items: (r) =>
    `${r.shop}:${r.category ?? ''}:${r.clientId}:${r.lookType ?? 0}:${r.count}:${r.name}`,
  pass_rewards: (r) =>
    r.kind === 'season' ? `season:${r.season}` : `${r.season}:${r.track}:${r.level}`,
  calendar_rewards: (r) =>
    r.kind === 'calendar' ? `${r.month}:meta` : `${r.month}:${r.calendar}:${r.slot}`,
  craft_recipes: (r) => `${r.workshopId}:${r.recipeId}`,
  // Only whether an item was listed on the Market: `readExport` keeps the clientId alone.
  market_listings: (r) => String(r.clientId),
  quest_rewards: (r) =>
    r.source === 'linked_task'
      ? `linked:${r.taskId}`
      : r.source === 'poke_task'
        ? `poke:${r.shardClientId}`
        : `${r.source}:${r.npc ?? ''}:${r.pokemon ?? ''}`,
};

/** The run folders of an export: `dir` itself when it is a run, else its `run_*` folders. */
export function runFolders(dir) {
  if (path.basename(dir).startsWith('run_')) return [dir];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run_'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(dir, name));
}

/**
 * Reads every type of `EXPORT_KEYS` from the runs, merged per key (later wins). Returns
 * `{ types: { [type]: record[] }, runs: string[], summaryErrors: number }`.
 */
export function readExport(dir) {
  const runs = runFolders(dir);
  const merged = Object.fromEntries(Object.keys(EXPORT_KEYS).map((type) => [type, new Map()]));
  let summaryErrors = 0;
  for (const run of runs) {
    const files = fs.readdirSync(run).sort();
    for (const [type, key] of Object.entries(EXPORT_KEYS)) {
      const chunk = new RegExp(`^${type}\\.\\d+\\.jsonl$`);
      for (const file of files.filter((name) => chunk.test(name))) {
        const lines = fs.readFileSync(path.join(run, file), 'utf8').split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          // A listing keeps its clientId alone: no price, seller or description is read on.
          const record = type === 'market_listings' ? { clientId: parsed.clientId } : parsed;
          merged[type].delete(key(record));
          merged[type].set(key(record), record);
        }
      }
    }
    const summary = path.join(run, 'summary.json');
    if (fs.existsSync(summary)) {
      const errors = JSON.parse(fs.readFileSync(summary, 'utf8')).errores;
      if (Array.isArray(errors)) summaryErrors += errors.length;
    }
  }
  const types = Object.fromEntries(
    Object.entries(merged).map(([type, map]) => [type, [...map.values()]]),
  );
  return { types, runs: runs.map((run) => path.basename(run)), summaryErrors };
}

// ------------------------------------------------------------------------------ helpers

export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const lower = (value) => String(value).trim().toLowerCase();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The client's `chance` (out of 100000) as a drop's `probabilidad` (%). The server hides every
 * rate under 1%: the client receives exactly 990 and shows «Muy Raro», so 990 is stored as
 * `probabilidad: null` with `muyRaro: true`, never as a real 0.99%. A chance of 0 or a missing
 * one is unknown (`null`).
 */
export const HIDDEN_RARE_CHANCE = 990;
export function dropChance(chance) {
  if (chance === HIDDEN_RARE_CHANCE) return { probabilidad: null, muyRaro: true };
  if (typeof chance !== 'number' || chance <= 0) return { probabilidad: null };
  return { probabilidad: chance / 1000 };
}
const isMissing = (value) => value === undefined || value === null;

/** The most repeated value of a list (by JSON), the first one seen on a tie. */
export function majority(values) {
  const counts = new Map();
  for (const value of values) {
    const key = JSON.stringify(value);
    const entry = counts.get(key) ?? { value, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  let best = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return { value: best?.value, distinct: counts.size };
}

/** «rocksmash» → «Rock Smash»; any other field ability gets the first letter upper-cased. */
export function abilityName(raw) {
  if (raw === 'rocksmash') return 'Rock Smash';
  return String(raw)
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const SPECIAL_TIERS = ['Super Rare', 'Ultra Rare', 'Legendary', 'Mythic', 'ULTIMATE'];

/** The game's tier text: a number, a special tier, or null (with `ok: false` for odd text). */
export function parseTier(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { value: null, ok: true };
  if (/^\d+$/.test(text) && Number(text) >= 1) return { value: Number(text), ok: true };
  if (SPECIAL_TIERS.includes(text)) return { value: text, ok: true };
  return { value: null, ok: false };
}

/** Pokédex effectiveness groups → the five groups of `efectividad`. */
export const EFFECTIVENESS_KEYS = {
  super: 'muyDebil',
  effective: 'debil',
  ineffective: 'resiste',
  superIneffective: 'muyResistente',
  immune: 'inmune',
};

/** passive > aoe > target (client priority) → `alcance`. */
export function moveReach(tags) {
  if (tags.includes('passive')) return 'pasivo';
  if (tags.includes('aoe')) return 'area';
  if (tags.includes('target')) return 'objetivo';
  return null;
}

/**
 * The moveset element (owner rule 2026-09-23): the element of the area moves; when they mix,
 * the most repeated and, on a tie, the first area move's. No area move → null.
 */
export function movesetElement(moves) {
  const area = moves.filter((move) => (move.tags ?? []).includes('aoe')).map((m) => m.element);
  if (area.length === 0) return { element: null, mixed: false };
  const counts = new Map();
  for (const element of area) counts.set(element, (counts.get(element) ?? 0) + 1);
  let best = area[0];
  for (const element of area) if (counts.get(element) > counts.get(best)) best = element;
  return { element: best, mixed: counts.size > 1 };
}

/** «X-Attack (Tier: 3)» → { ranura: 'x', efecto: 'X-Attack', tier: 3 }. */
export function parseHeld(title) {
  const match = /^([XY])-(.+?) \(Tier: (\d+)\)$/.exec(String(title).trim());
  if (!match) return null;
  return { ranura: match[1].toLowerCase(), efecto: `${match[1]}-${match[2]}`, tier: +match[3] };
}

/** «Price: $3,000.» in an inspection → 3000. */
export function inspectPrice(rows) {
  for (const row of rows ?? []) {
    if (row.section !== 'header' || typeof row.text !== 'string') continue;
    const match = /^Price: \$([\d,]+)\.?$/m.exec(row.text);
    if (match) return Number(match[1].replace(/,/g, ''));
  }
  return null;
}

/** The inspection text without «You see …» and the «Price:» line; null when nothing is left. */
export function inspectDescription(rows) {
  const lines = [];
  for (const row of rows ?? []) {
    if ((row.section !== 'header' && row.section !== 'info') || typeof row.text !== 'string')
      continue;
    row.text.split('\n').forEach((line, index) => {
      const text = line.trim();
      if (!text) return;
      if (row.section === 'header' && index === 0 && /^You see /.test(text)) return;
      if (/^Price: \$/.test(text)) return;
      lines.push(text);
    });
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * The evolution stages of a Pokédex chain: an entry with `branch: true` right after another
 * `branch: true` entry is a sibling of it; any other entry opens a new stage. (Eevee: stage 0
 * Eevee, stage 1 every Eeveelution; Oddish: Oddish, Gloom, Vileplume + Bellossom.)
 */
export function evolutionStages(chain) {
  const stages = [];
  chain.forEach((entry, index) => {
    const sibling = entry.branch && index > 0 && chain[index - 1].branch;
    if (sibling) stages[stages.length - 1].push(entry);
    else stages.push([entry]);
  });
  return stages;
}

/** The names the Pokémon of a detail evolves into, with the level of each target. */
export function evolutionTargets(detail) {
  const stages = evolutionStages(detail.evolutions ?? []);
  const at = stages.findIndex((stage) => stage.some((entry) => entry.current));
  const targets = [];
  if (at !== -1 && at + 1 < stages.length)
    for (const entry of stages[at + 1])
      targets.push({
        name: entry.name,
        nivel: entry.requiredLevel > 0 ? entry.requiredLevel : null,
      });
  // A stone group can name a target the chain does not list (Silcoon → Beautifly).
  for (const group of detail.stones ?? [])
    if (!targets.some((target) => lower(target.name) === lower(group.evolution)))
      targets.push({ name: group.evolution, nivel: null });
  return targets;
}

// ------------------------------------------------------------------------------ constants

/** Market category of `market_catalog` → content/items/<categoria>.json (plan §4). */
export const MARKET_CATEGORIES = {
  Diamonds: 'diamantes',
  Pokémon: 'pokemon',
  'Poké Balls': 'poke-balls',
  Stones: 'stones',
  Helds: 'helds',
  Orbs: 'orbs',
  'Creature Items': 'creature-items',
  'General Items': 'general-items',
  Utilities: 'utilities',
  Addons: 'addons',
  Consumable: 'consumable',
  Foods: 'foods',
  Furnitures: 'furnitures',
};

/**
 * Shop codes of the exporter → the shop name shown (plan §8: the owner decides the text). The
 * names are the ones items.schema.json lists; edit here if the game writes them otherwise.
 */
export const SHOP_NAMES = {
  diamond_store: 'Diamond Shop',
  online_shop: 'Online Shop',
  twitch_shop: 'Twitch Shop',
  daily_shop: 'Daily Shop',
  battle_pass: 'Game Pass Shop',
};

/** Currency codes of the exporter → the currency shown (owner decision; edit here). */
export const CURRENCY_NAMES = {
  diamonds: 'Diamonds',
  online_points: 'Online Points',
  twitch_points: 'Twitch Points',
  daily_points: 'Daily Points',
  pass_points: 'Pass Points',
};

/**
 * Fields the owner writes by hand: an existing value is never replaced by the export (owner
 * decision 2026-09-25). `mercado` is here because the importer only ever writes `true`, and
 * `false` is the owner's mark.
 */
export const OWNER_FIELDS = new Set([
  'id',
  'nombre',
  'categoria',
  'sprite',
  'borrador',
  'imagen',
  'funcion',
  'generacion',
  'uso',
  'apilable',
  'mercado',
  'alias',
  'aliases',
]);

/** `textoJuego` fields: the export writes its own language and leaves the other one. */
const GAME_TEXT_FIELDS = new Set(['descripcion']);

/** Category of the items the game names outside the Market catalog (owner, 2026-09-25). */
export const OTHER_CATEGORY = 'otros';

/** Sprite of an item the importer creates: the documented placeholder (docs/REGISTROS.md). */
export const PLACEHOLDER_ITEM_SPRITE = 'ui/comercio/item';

// ------------------------------------------------------------------------------ the import

/**
 * Applies an export to the content records, in place. `content` is
 * `{ pokemon: record[], moves: record[], items: { [categoria]: record[] }, elements: string[],
 * quests: record[] }`. The game's value wins over an existing one for game facts (reported);
 * `options.keep` is a Set of more fields whose existing values stay. Returns the report.
 */
export function applyExport(types, content, options = {}) {
  const keep = options.keep ?? new Set();
  const elementSet = new Set(content.elements);
  const report = {
    changes: { pokemon: new Map(), moves: new Map(), items: new Map() },
    created: { items: [], moves: [] },
    unmatchedPokemon: [],
    pokemonWithoutDetail: [],
    differences: [],
    replaced: [],
    unknownElements: new Map(),
    oddTiers: [],
    mixedMoveset: [],
    moveConflicts: [],
    missingItems: new Map(),
    skippedEvolutions: [],
    missingEvolutionTargets: [],
    duplicateDrops: [],
    catalogWithoutCategory: [],
    catalogCategoryMismatch: [],
    heldsUnparsed: [],
    npcPriceConflicts: [],
    npcInspectDisagree: [],
    skippedRecipes: [],
    megaStones: [],
    unresolvedRewards: new Map(),
    extraDetailFields: new Set(),
    unnamedItems: [],
    createdPokemon: [],
    roleValues: new Map(),
  };
  const bump = (kind, field) =>
    report.changes[kind].set(field, (report.changes[kind].get(field) ?? 0) + 1);
  const missItem = (clientId, name, use) => {
    const key = String(clientId);
    const entry = report.missingItems.get(key) ?? { clientId, name, uses: new Set() };
    entry.uses.add(use);
    report.missingItems.set(key, entry);
  };

  /**
   * Whether the export may replace an existing, different value of `field` (owner decision
   * 2026-09-25: the client is authoritative for game facts). Owner-authored fields and the
   * fields of `options.keep` are never replaced: the difference is only reported. Every
   * replacement is reported too.
   */
  const mayReplace = (kind, id, field, current, incoming) => {
    const root = field.split('.')[0];
    if (OWNER_FIELDS.has(root) || keep.has(root)) {
      report.differences.push({ kind, id, field, current, incoming });
      return false;
    }
    report.replaced.push({ kind, id, field, current, incoming });
    return true;
  };

  /**
   * Writes `value` into `record[field]`: when the field is missing or null, or when it differs
   * and `mayReplace` lets the game's value win. A `textoJuego` ({ es } or { en }) only replaces
   * its own language. Returns true when it wrote.
   */
  const fill = (kind, record, field, value, label = record.id) => {
    if (value === undefined) return false;
    const current = record[field];
    // An unknown (null) never erases a known value.
    if (value === null && !isMissing(current)) return false;
    const gameText = GAME_TEXT_FIELDS.has(field) && current !== null && typeof current === 'object';
    const next = gameText && value !== null ? { ...current, ...value } : value;
    if (same(current, next)) return false;
    if (!isMissing(current) && !mayReplace(kind, label, field, current, next)) return false;
    record[field] = next;
    bump(kind, field);
    return true;
  };

  // ---------------------------------------------------------------- items: index and catalog
  const allItems = () => Object.values(content.items).flat();
  const itemByClient = new Map();
  const itemByName = new Map();
  const indexItem = (item) => {
    if (Number.isInteger(item.clientId)) itemByClient.set(item.clientId, item);
    if (item.borrador !== true) itemByName.set(lower(item.nombre), item);
  };
  allItems().forEach(indexItem);
  const itemIds = new Set(allItems().map((item) => item.id));

  const inspect = new Map(types.items.map((record) => [record.clientId, record]));
  const catalogClients = new Set();

  for (const entry of types.market_catalog) {
    catalogClients.add(entry.clientId);
    const categoria = MARKET_CATEGORIES[entry.category];
    let item = itemByClient.get(entry.clientId);
    if (!item) {
      const byName = itemByName.get(lower(entry.name));
      if (byName && isMissing(byName.clientId)) {
        byName.clientId = entry.clientId;
        itemByClient.set(entry.clientId, byName);
        bump('items', 'clientId');
        item = byName;
      }
    }
    if (item) {
      if (categoria && item.categoria !== categoria)
        report.catalogCategoryMismatch.push({
          id: item.id,
          file: item.categoria,
          market: categoria,
        });
      continue;
    }
    if (!categoria) {
      report.catalogWithoutCategory.push(entry);
      continue;
    }
    const title = inspect.get(entry.clientId)?.title ?? entry.name;
    let held;
    if (categoria === 'helds') {
      held = parseHeld(entry.name) ?? parseHeld(title);
      if (!held || held.tier > 8) {
        report.heldsUnparsed.push(entry);
        continue;
      }
    }
    let id = held ? `${slugify(held.efecto)}-t${held.tier}` : slugify(entry.name);
    if (!id || itemIds.has(id)) id = `${id || 'item'}-${entry.clientId}`;
    itemIds.add(id);
    const created = {
      id,
      nombre: entry.name,
      clientId: entry.clientId,
      categoria,
      sprite: PLACEHOLDER_ITEM_SPRITE,
      apilable: null,
      precioNpc: { vende: null, compra: null },
      ...(held ? { held } : {}),
    };
    (content.items[categoria] ??= []).push(created);
    indexItem(created);
    report.created.items.push(created);
  }

  // Items the game names outside the Market catalog (loot, evolutions, crafting, shops, the pass,
  // the calendar, tasks): owner decision 2026-09-25, created in «otros» until the owner moves
  // them to their category. Their id is the name's slug (the client id on a clash), never the
  // category, so it survives the move. The name is the inspection title when the client has it.
  if (options.createItems !== false) {
    const wanted = new Map();
    const want = (clientId, name) => {
      if (!Number.isInteger(clientId) || clientId <= 0 || wanted.has(clientId)) return;
      wanted.set(clientId, name);
    };
    for (const detail of types.pokedex_detail) {
      for (const zone of detail.loot ?? [])
        for (const drop of zone.drops ?? []) want(drop.itemId, drop.name);
      for (const group of detail.stones ?? [])
        for (const stone of group.stones ?? []) want(stone.itemId, stone.name);
    }
    for (const recipe of types.craft_recipes) {
      want(recipe.clientId, recipe.name);
      for (const material of recipe.materials ?? []) want(material.clientId, undefined);
    }
    for (const shop of types.shop_items) want(shop.clientId, shop.name);
    for (const reward of types.pass_rewards)
      if (reward.kind === 'reward') want(reward.clientId, reward.name);
    for (const reward of types.calendar_rewards)
      if (reward.kind === 'day' || reward.kind === 'after21') want(reward.clientId, reward.name);
    for (const task of types.quest_rewards) {
      for (const reward of task.reward?.items ?? []) want(reward.clientId, undefined);
      for (const reward of task.rewards ?? []) want(reward.clientId, undefined);
    }
    for (const [clientId, referenced] of wanted) {
      if (itemByClient.has(clientId)) continue;
      const name = String(inspect.get(clientId)?.title ?? referenced ?? '').trim();
      if (!name) {
        report.unnamedItems.push(clientId);
        continue;
      }
      const byName = itemByName.get(lower(name));
      if (byName && isMissing(byName.clientId)) {
        byName.clientId = clientId;
        itemByClient.set(clientId, byName);
        bump('items', 'clientId');
        continue;
      }
      let id = slugify(name);
      if (!id || itemIds.has(id)) id = `${id || 'item'}-${clientId}`;
      itemIds.add(id);
      const held = parseHeld(name);
      const created = {
        id,
        nombre: name,
        clientId,
        categoria: OTHER_CATEGORY,
        sprite: PLACEHOLDER_ITEM_SPRITE,
        apilable: null,
        precioNpc: { vende: null, compra: null },
        ...(held && held.tier <= 8 ? { held } : {}),
      };
      (content.items[OTHER_CATEGORY] ??= []).push(created);
      indexItem(created);
      report.created.items.push(created);
    }
  }
  // Seen on the Market: its catalog, or a listing (only the listing's clientId is read).
  for (const entry of types.market_listings)
    if (Number.isInteger(entry.clientId)) catalogClients.add(entry.clientId);

  /** The content id of an item of the export, by clientId, then by exact name. */
  const itemId = (clientId, name) => {
    const byClient = itemByClient.get(clientId);
    if (byClient) return byClient.id;
    const byName = name === undefined ? undefined : itemByName.get(lower(name));
    return byName?.id ?? null;
  };

  // ---------------------------------------------------------------- items: per-item facts
  const npcByClient = new Map();
  for (const entry of types.npc_trade) {
    const list = npcByClient.get(entry.clientId) ?? [];
    list.push(entry);
    npcByClient.set(entry.clientId, list);
  }

  for (const item of allItems()) {
    if (!Number.isInteger(item.clientId)) continue;
    // Market: true when the Market's catalog or a listing has it. Never `false`: only the owner
    // marks an item the Market does not take.
    if (catalogClients.has(item.clientId)) fill('items', item, 'mercado', true);

    const inspection = inspect.get(item.clientId);
    const description = inspection ? inspectDescription(inspection.rows) : null;
    if (description) fill('items', item, 'descripcion', { en: description });

    // NPC prices: a shop of an NPC first; its `sellPrice` is what the NPC pays (`vende`), its
    // `buyPrice` what it charges (`compra`); 0 = that side does not exist → null.
    const shops = npcByClient.get(item.clientId) ?? [];
    const inspected = inspection ? inspectPrice(inspection.rows) : null;
    let vende = null;
    let compra = null;
    if (shops.length > 1) {
      report.npcPriceConflicts.push({
        id: item.id,
        prices: shops.map((s) => [s.buyPrice ?? 0, s.sellPrice ?? 0]),
      });
    } else if (shops.length === 1) {
      vende = shops[0].sellPrice > 0 ? shops[0].sellPrice : null;
      compra = shops[0].buyPrice > 0 ? shops[0].buyPrice : null;
      if (inspected !== null && vende !== inspected)
        report.npcInspectDisagree.push({ id: item.id, npc: vende, inspect: inspected });
    } else if (inspected !== null) {
      vende = inspected;
    }
    const precio = { ...item.precioNpc };
    let changed = false;
    for (const [side, value] of [
      ['vende', vende],
      ['compra', compra],
    ]) {
      if (value === null || precio[side] === value) continue;
      if (
        !isMissing(precio[side]) &&
        !mayReplace('items', item.id, `precioNpc.${side}`, precio[side], value)
      )
        continue;
      precio[side] = value;
      changed = true;
    }
    if (changed) {
      item.precioNpc = precio;
      bump('items', 'precioNpc');
    }
  }

  // ---------------------------------------------------------------- Pokémon
  const pokemonByName = new Map(content.pokemon.map((record) => [lower(record.nombre), record]));
  const pokemonById = new Map(content.pokemon.map((record) => [record.id, record]));
  const findPokemon = (name) =>
    pokemonByName.get(lower(name)) ?? pokemonById.get(slugify(name)) ?? null;

  const details = types.pokedex_detail;

  // Every Pokédex entry is a record (owner decision 2026-09-25: Mega forms, Castform and
  // Smeargle forms, shinies and the missing species are all usable in the game). A new record
  // follows the existing ones: id = slug of the game name, the Pokédex number, the generation
  // of the records of the same number, and the client art of its species (`NNN` or `NNN.1` for a
  // shiny) only where the art is the same Pokémon — a named type form of Smeargle, or a plain
  // shiny; a Mega or a Castform form has its own look, so `imagen` stays null («?»). The rest
  // (level, tier, elements…) the import below fills like any other record.
  if (options.createPokemon !== false) {
    const hasArt = options.hasArt ?? (() => false);
    for (const detail of details) {
      if (findPokemon(detail.name)) continue;
      const name = String(detail.name);
      const shiny = /^Shiny /.test(name);
      const numero = Number.isInteger(detail.id) && detail.id > 0 ? detail.id : null;
      const kin =
        numero === null ? [] : content.pokemon.filter((record) => record.numero === numero);
      const species = (detail.shinyIds ?? [])[0];
      const base = shiny ? name.replace(/^Shiny /, '') : name;
      const ownLook =
        lower(base) === lower(species ?? '') ||
        /^Smeargle /.test(base) ||
        kin.some((r) => r.nombre === base);
      const dex = numero === null ? null : String(numero).padStart(3, '0') + (shiny ? '.1' : '');
      const imagen =
        dex !== null && ownLook && !/^Mega /.test(base) && hasArt(dex)
          ? `/pokemon/${dex}.png`
          : null;
      const record = {
        id: slugify(name),
        nombre: name,
        numero,
        generacion: kin.find((r) => r.generacion !== null)?.generacion ?? null,
        variante: shiny ? 'shiny' : 'normal',
        nivel: null,
        tier: null,
        funcion: null,
        elementos: [],
        imagen,
      };
      if (!record.id || pokemonById.has(record.id)) {
        report.unmatchedPokemon.push(`${name} (#${detail.id}): id ocupado`);
        continue;
      }
      // After the last record of its number, or before the first with a higher one.
      let at = -1;
      content.pokemon.forEach((r, index) => {
        if (numero !== null && r.numero === numero) at = index + 1;
      });
      if (at === -1) {
        const next = content.pokemon.findIndex(
          (r) => numero !== null && r.numero !== null && r.numero > numero,
        );
        at = next === -1 ? content.pokemon.length : next;
      }
      content.pokemon.splice(at, 0, record);
      pokemonByName.set(lower(name), record);
      pokemonById.set(record.id, record);
      report.createdPokemon.push(record.id);
    }
  }

  const matched = [];
  for (const detail of details) {
    const record = findPokemon(detail.name);
    if (!record) {
      report.unmatchedPokemon.push(`${detail.name} (#${detail.id})`);
      continue;
    }
    matched.push({ detail, record });
  }
  const seenRecords = new Set(matched.map(({ record }) => record.id));
  report.pokemonWithoutDetail = content.pokemon
    .filter((record) => !seenRecords.has(record.id))
    .map((record) => record.nombre);

  const KNOWN_FIELDS = new Set([
    'id',
    'name',
    'shinyId',
    'shinyIds',
    'firstElement',
    'secondElement',
    'level',
    'tier',
    'worldCount',
    'role',
    'heavy',
    'fast',
    'evolutions',
    'evoNote',
    'stones',
    'habilities',
    'effectiveness',
    'description',
    'moves',
    'loot',
  ]);

  const validElement = (element, where) => {
    if (!element) return null;
    if (elementSet.has(element)) return element;
    report.unknownElements.set(element, (report.unknownElements.get(element) ?? 0) + 1);
    void where;
    return null;
  };

  // Moves, gathered over every matched Pokémon.
  const moveUses = new Map();
  const pendingMoves = [];

  for (const { detail, record } of matched) {
    Object.keys(detail).forEach(
      (key) => KNOWN_FIELDS.has(key) || report.extraDetailFields.add(key),
    );
    report.roleValues.set(detail.role, (report.roleValues.get(detail.role) ?? 0) + 1);

    if (Number.isInteger(detail.id) && detail.id > 0) fill('pokemon', record, 'numero', detail.id);

    fill('pokemon', record, 'nivel', detail.level > 0 ? detail.level : null);

    const tier = parseTier(detail.tier);
    if (!tier.ok) report.oddTiers.push(`${detail.name}: «${detail.tier}»`);
    if (tier.value !== null) fill('pokemon', record, 'tier', tier.value);

    const elementos = [detail.firstElement, detail.secondElement]
      .map((element) => validElement(element))
      .filter(Boolean);
    if (elementos.length > 0) {
      // An empty list is «not written yet»: filled without a report.
      if ((record.elementos ?? []).length === 0) record.elementos = null;
      fill('pokemon', record, 'elementos', elementos);
    }

    const description = String(detail.description ?? '').trim();
    if (description) fill('pokemon', record, 'descripcion', { es: description });
    if (typeof detail.fast === 'boolean') fill('pokemon', record, 'rapido', detail.fast);
    if (typeof detail.heavy === 'boolean') fill('pokemon', record, 'pesado', detail.heavy);
    if (Array.isArray(detail.habilities))
      fill('pokemon', record, 'habilidades', detail.habilities.map(abilityName));

    if (detail.effectiveness) {
      const efectividad = {};
      for (const [from, to] of Object.entries(EFFECTIVENESS_KEYS))
        efectividad[to] = (detail.effectiveness[from] ?? [])
          .map((element) => validElement(element))
          .filter(Boolean);
      fill('pokemon', record, 'efectividad', efectividad);
    }

    // Moves in the game's order. Passive moves take no key (they are always after the others).
    const moves = detail.moves ?? [];
    if (moves.length > 0) {
      let key = 0;
      const movimientos = moves.map((move) => {
        const passive = (move.tags ?? []).includes('passive');
        const cooldown = (value) => (typeof value === 'number' && value > 0 ? value : null);
        const entry = {
          movimiento: slugify(move.name),
          slot: passive ? null : `M${++key}`,
          cooldownPve: cooldown(move.cooldownPve),
          cooldownPvp: cooldown(move.cooldownPvp),
        };
        const own = {
          elemento: validElement(move.element),
          alcance: moveReach(move.tags ?? []),
          efectos: [...(move.effects ?? [])].map(slugify),
        };
        const uses = moveUses.get(entry.movimiento) ?? [];
        uses.push({ move, record, entry });
        moveUses.set(entry.movimiento, uses);
        return { entry, own };
      });
      // The same move twice in one Pokémon keeps its first place. The list is written once the
      // moves registry is known, with what differs from each move's own values.
      const unique = movimientos.filter(
        (item, index) =>
          movimientos.findIndex((other) => other.entry.movimiento === item.entry.movimiento) ===
          index,
      );
      pendingMoves.push({ record, list: unique });
      const moveset = movesetElement(moves);
      if (moveset.mixed) report.mixedMoveset.push(detail.name);
      fill('pokemon', record, 'elementoMoveset', validElement(moveset.element));
    }

    // Loot: Base → drops, Wildscape and Primal → dropsPorZona. Items the registry does not have
    // are left out and listed.
    const zoneDrops = (region) => {
      const zone = (detail.loot ?? []).find((entry) => entry.region === region);
      if (!zone) return undefined;
      const list = [];
      for (const drop of zone.drops ?? []) {
        const id = itemId(drop.itemId, drop.name);
        if (!id) {
          missItem(drop.itemId, drop.name, 'drop');
          continue;
        }
        if (list.some((entry) => entry.item === id)) {
          report.duplicateDrops.push(`${detail.name} ${region}: ${id}`);
          continue;
        }
        const min = Math.max(drop.countMin ?? 1, 1);
        const max = Math.max(drop.countMax ?? min, min);
        list.push({ item: id, cantidad: { min, max }, ...dropChance(drop.chance) });
      }
      return list;
    };
    const base = zoneDrops('Base');
    if (base !== undefined) fill('pokemon', record, 'drops', base);
    const wild = zoneDrops('Wildscape');
    const primal = zoneDrops('Primal');
    if (wild !== undefined || primal !== undefined) {
      const current = record.dropsPorZona ?? {};
      const next = { ...current };
      let changed = false;
      for (const [zone, list] of [
        ['wildscape', wild],
        ['primal', primal],
      ]) {
        if (list === undefined || same(current[zone], list)) continue;
        if (
          current[zone] !== undefined &&
          !mayReplace('pokemon', record.id, `dropsPorZona.${zone}`, '(lista)', '(lista)')
        )
          continue;
        next[zone] = list;
        changed = true;
      }
      if (changed) {
        record.dropsPorZona = next;
        bump('pokemon', 'dropsPorZona');
      }
    }

    // Evolutions: a step is written only when its target and all its items are known.
    const evolucion = [];
    for (const target of evolutionTargets(detail)) {
      const to = findPokemon(target.name);
      if (!to) {
        report.missingEvolutionTargets.push(`${detail.name} → ${target.name}`);
        continue;
      }
      if (to.id === record.id) continue;
      const group = (detail.stones ?? []).find(
        (entry) => lower(entry.evolution) === lower(target.name),
      );
      const items = [];
      const missing = [];
      for (const stone of group?.stones ?? []) {
        const id = itemId(stone.itemId, stone.name);
        if (!id) {
          missing.push(stone.name);
          missItem(stone.itemId, stone.name, 'evolución');
          continue;
        }
        items.push({ item: id, cantidad: Math.max(stone.count ?? 1, 1) });
      }
      if (missing.length > 0) {
        report.skippedEvolutions.push(`${detail.name} → ${target.name} (${missing.join(', ')})`);
        continue;
      }
      if (evolucion.some((step) => step.a === to.id)) continue;
      evolucion.push({ a: to.id, nivel: target.nivel, items });
    }
    if (evolucion.length > 0) fill('pokemon', record, 'evolucion', evolucion);
  }

  // ---------------------------------------------------------------- moves
  const moveById = new Map(content.moves.map((move) => [move.id, move]));
  const pokemonOrder = new Map(content.pokemon.map((record, index) => [record.id, index]));
  for (const [id, uses] of moveUses) {
    const elements = majority(uses.map((use) => validElement(use.move.element)));
    const reach = majority(uses.map((use) => moveReach(use.move.tags ?? [])));
    const effects = majority(uses.map((use) => [...(use.move.effects ?? [])].map(slugify)));
    const desc = majority(uses.map((use) => String(use.move.desc ?? '').trim()));
    const slots = majority(uses.map((use) => use.entry.slot));
    const cooldowns = majority(uses.map((use) => use.entry.cooldownPve));
    const name = uses[0].move.name;
    for (const [what, result] of [
      ['elemento', elements],
      ['alcance', reach],
      ['descripción', desc],
      ['efectos', effects],
    ])
      if (result.distinct > 1)
        report.moveConflicts.push(`${name}: ${result.distinct} valores de ${what}`);
    const pokemon = [...new Set(uses.map((use) => use.record.id))];
    let move = moveById.get(id);
    if (!move) {
      move = {
        id,
        nombre: name,
        elemento: null,
        slot: null,
        cooldownSegundos: null,
        modo: null,
        pokemon: [],
      };
      content.moves.push(move);
      moveById.set(id, move);
      report.created.moves.push(id);
    }
    fill('moves', move, 'elemento', elements.value ?? null);
    // One key and one cooldown only when every Pokémon agrees; otherwise they stay per Pokémon.
    if (slots.distinct === 1) fill('moves', move, 'slot', slots.value);
    if (cooldowns.distinct === 1 && cooldowns.value !== null) {
      if (fill('moves', move, 'cooldownSegundos', cooldowns.value))
        fill('moves', move, 'modo', 'PVE');
    }
    const union = [...new Set([...(move.pokemon ?? []), ...pokemon])].sort(
      (a, b) => (pokemonOrder.get(a) ?? 0) - (pokemonOrder.get(b) ?? 0),
    );
    if (!same(union, move.pokemon)) {
      move.pokemon = union;
      bump('moves', 'pokemon');
    }
    fill('moves', move, 'alcance', reach.value ?? null);
    fill('moves', move, 'efectos', effects.value ?? []);
    if (desc.value) fill('moves', move, 'descripcion', { es: desc.value });
  }

  // Each Pokémon's moves, with the element, reach and effects its version has when they are not
  // the move's own.
  for (const { record, list } of pendingMoves) {
    const movimientos = list.map(({ entry, own }) => {
      const move = moveById.get(entry.movimiento);
      const result = { ...entry };
      if (move && !same(own.elemento, move.elemento ?? null)) result.elemento = own.elemento;
      if (move && !same(own.alcance, move.alcance ?? null)) result.alcance = own.alcance;
      if (move && !same(own.efectos, move.efectos ?? [])) result.efectos = own.efectos;
      return result;
    });
    fill('pokemon', record, 'movimientos', movimientos);
  }

  // ---------------------------------------------------------------- obtención
  const itemOfClient = new Map(
    allItems()
      .filter((item) => Number.isInteger(item.clientId))
      .map((item) => [item.clientId, item]),
  );
  const obtain = new Map();
  const addObtain = (clientId, name, list, entry, source) => {
    const item = itemOfClient.get(clientId);
    if (!item) {
      const miss = report.unresolvedRewards.get(source) ?? new Map();
      miss.set(clientId, name);
      report.unresolvedRewards.set(source, miss);
      return;
    }
    const lists = obtain.get(item) ?? {};
    lists[list] ??= [];
    if (!lists[list].some((other) => same(other, entry))) lists[list].push(entry);
    obtain.set(item, lists);
  };

  for (const shop of types.shop_items) {
    if (!Number.isInteger(shop.clientId) || shop.clientId <= 0) continue;
    addObtain(
      shop.clientId,
      shop.name,
      'tiendas',
      {
        tienda: SHOP_NAMES[shop.shop] ?? shop.shop,
        precio: Number.isInteger(shop.price) ? shop.price : null,
        moneda: CURRENCY_NAMES[shop.currency] ?? null,
        cantidad: shop.count > 0 ? shop.count : null,
      },
      'shop_items',
    );
  }
  for (const reward of types.pass_rewards) {
    if (reward.kind !== 'reward' || !(reward.clientId > 0)) continue;
    const temporada = Number.parseInt(String(reward.season).replace(/\D+/g, ''), 10);
    addObtain(
      reward.clientId,
      reward.name,
      'pase',
      {
        temporada: Number.isInteger(temporada) && temporada > 0 ? temporada : null,
        nivel: reward.level > 0 ? reward.level : null,
        pista: reward.track === 'premium' ? 'premium' : 'gratis',
        cantidad: reward.count > 0 ? reward.count : null,
      },
      'pass_rewards',
    );
  }
  for (const reward of types.calendar_rewards) {
    if ((reward.kind !== 'day' && reward.kind !== 'after21') || !(reward.clientId > 0)) continue;
    const month = Number(/-(\d{1,2})$/.exec(String(reward.month))?.[1]);
    const after = reward.kind === 'after21';
    addObtain(
      reward.clientId,
      reward.name,
      'calendario',
      {
        mes: month >= 1 && month <= 12 ? month : null,
        dia: !after && reward.day >= 1 && reward.day <= 21 ? reward.day : null,
        trasDia21: after,
        calendario: reward.calendar === 'premium' ? 'premium' : 'gratis',
        cantidad: reward.count > 0 ? reward.count : null,
      },
      'calendar_rewards',
    );
  }
  const questByName = new Map(
    (content.quests ?? []).map((quest) => [lower(quest.nombre), quest.id]),
  );
  for (const task of types.quest_rewards) {
    if (task.source === 'linked_task') {
      for (const reward of task.reward?.items ?? []) {
        const actividad = questByName.get(lower(task.name));
        addObtain(
          reward.clientId,
          String(reward.clientId),
          'tareas',
          {
            tipo: 'linked-task',
            nombre: task.name,
            ...(actividad ? { actividad } : {}),
            cantidad: reward.count > 0 ? reward.count : null,
          },
          'quest_rewards',
        );
      }
    } else if (task.source === 'poke_task') {
      for (const reward of task.rewards ?? [])
        addObtain(
          reward.clientId,
          String(reward.clientId),
          'tareas',
          {
            tipo: 'poke-task',
            nombre: task.banner ?? 'Poke Task',
            cantidad: reward.count > 0 ? reward.count : null,
          },
          'quest_rewards',
        );
    }
  }
  for (const recipe of types.craft_recipes) {
    const materiales = [];
    const missing = [];
    for (const material of recipe.materials ?? []) {
      const id = itemId(material.clientId);
      if (!id) missing.push(material.clientId);
      else materiales.push({ item: id, cantidad: material.count > 0 ? material.count : null });
    }
    if (!itemOfClient.has(recipe.clientId)) {
      addObtain(recipe.clientId, recipe.name, 'recetas', null, 'craft_recipes');
      continue;
    }
    if (missing.length > 0) {
      report.skippedRecipes.push(
        `${recipe.name} (${recipe.workshop}): materiales sin registro ${missing.join(', ')}`,
      );
      continue;
    }
    addObtain(
      recipe.clientId,
      recipe.name,
      'recetas',
      {
        taller: recipe.workshop || null,
        cantidad: recipe.count > 0 ? recipe.count : null,
        tiempoSegundos: typeof recipe.timePerUnit === 'number' ? recipe.timePerUnit : null,
        materiales,
      },
      'craft_recipes',
    );
  }
  for (const [item, lists] of obtain) {
    const current = item.obtencion ?? {};
    const next = { ...current };
    let changed = false;
    for (const [list, entries] of Object.entries(lists)) {
      if (same(current[list], entries)) continue;
      if (
        current[list] !== undefined &&
        current[list].length > 0 &&
        !mayReplace('items', item.id, `obtencion.${list}`, '(lista)', '(lista)')
      )
        continue;
      next[list] = entries;
      changed = true;
    }
    if (changed) {
      item.obtencion = next;
      bump('items', 'obtencion');
    }
  }

  // ---------------------------------------------------------------- Mega Stones
  // Stone → the Pokémon with a Mega form whose name shares the longest start with the stone's
  // (Venusaurite → Venusaur, Charizardite X → Charizard). Only items the registry has get `mega`.
  const megaBases = [
    ...new Set(
      details
        .filter((detail) => /^Mega /.test(detail.name))
        .map((detail) => detail.name.replace(/^Mega /, '').replace(/ [XY]$/, '')),
    ),
  ];
  const stoneNames = new Map();
  for (const stone of types.megastones) stoneNames.set(stone.itemId, stone.name);
  for (const record of types.items)
    if (/can Mega Evolve/.test(record.rows?.[0]?.text ?? ''))
      stoneNames.set(record.clientId, record.title);
  for (const [clientId, rawName] of stoneNames) {
    const name = String(rawName)
      .replace(/^sealed /i, '')
      .replace(/ [XY]$/, '');
    let best = null;
    let bestLength = 0;
    let tie = false;
    for (const base of megaBases) {
      let length = 0;
      while (
        length < Math.min(base.length, name.length) &&
        base[length].toLowerCase() === name[length].toLowerCase()
      )
        length++;
      if (length > bestLength) {
        best = base;
        bestLength = length;
        tie = false;
      } else if (length === bestLength && length > 0) tie = true;
    }
    const pokemon = best && bestLength >= 4 && !tie ? findPokemon(best) : null;
    const item = itemOfClient.get(clientId);
    report.megaStones.push({
      clientId,
      name: rawName,
      pokemon: pokemon?.id ?? null,
      item: item?.id ?? null,
    });
    if (item && pokemon) fill('items', item, 'mega', { pokemon: [pokemon.id] });
  }

  return report;
}
