// Pure sprite-sheet math shared by the game Sprite, SpriteStyles and their tests.
// A sheet is a horizontal strip of `frames` frames, each `frame[0]` × `frame[1]` px.

export const spriteModes = ['estatico', 'variante', 'cantidad', 'animacion'] as const;
export type SpriteMode = (typeof spriteModes)[number];

export const spriteDirections = ['norte', 'este', 'sur', 'oeste'] as const;
export type SpriteDirection = (typeof spriteDirections)[number];

export type SpriteEntry = {
  archivo: string;
  frame: [number, number];
  frames: number;
  modo: SpriteMode;
  umbrales?: number[];
  duracionMs?: number[];
  loop?: boolean;
  direcciones?: Record<SpriteDirection, string>;
  borrador?: boolean;
};

export type SpriteRegistry = Record<string, SpriteEntry>;

export type SpriteOptions = {
  /** Frame to show (0-based). Ignored when `cantidad` picks the frame. */
  frame?: number;
  /** Stack size; only for `cantidad` sprites. */
  cantidad?: number;
  /** Play the animation; only for `animacion` sprites. */
  animado?: boolean;
  /** Integer scale, 1–16. */
  escala?: number;
  /** Outfit facing; only for sprites with `direcciones`. */
  direccion?: SpriteDirection;
};

export type ResolvedSprite = {
  key: string;
  src: string;
  frame: number;
  width: number;
  height: number;
  /** object-position that shows `frame` inside an `object-fit: cover` box. */
  objectPosition: string;
  aspectRatio: string;
  /** Keyframes name when the sprite animates, otherwise null. */
  animation: string | null;
};

export class SpriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpriteError';
  }
}

export const SPRITES_BASE_URL = '/sprites/';

/** Side of a game cell (spec 7.4.3). A sprite of 2 × 2 tiles fills a cell of 64. */
export const CELL = 32;

export function spriteUrl(archivo: string): string {
  return `${SPRITES_BASE_URL}${archivo}`;
}

export function getSpriteEntry(registry: SpriteRegistry, key: string): SpriteEntry {
  const entry = Object.hasOwn(registry, key) ? registry[key] : undefined;
  if (!entry) throw new SpriteError(`El sprite "${key}" no existe en public/sprites/sprites.json.`);
  return entry;
}

function assertFrame(key: string, entry: SpriteEntry, frame: number): number {
  if (!Number.isInteger(frame) || frame < 0 || frame >= entry.frames) {
    throw new SpriteError(
      `Frame ${frame} fuera de rango para "${key}": tiene ${entry.frames} frame(s) (0–${entry.frames - 1}).`,
    );
  }
  return frame;
}

/** Index of the last threshold that `cantidad` reaches; below the first one shows frame 0. */
export function frameForQuantity(umbrales: readonly number[], cantidad: number): number {
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new SpriteError(`Cantidad inválida: ${cantidad}. Usa un entero mayor o igual a 0.`);
  }
  let frame = 0;
  umbrales.forEach((minimo, index) => {
    if (cantidad >= minimo) frame = index;
  });
  return frame;
}

/** Frame shown for the given options, validated against the entry. */
export function resolveFrame(key: string, entry: SpriteEntry, options: SpriteOptions = {}): number {
  if (options.cantidad !== undefined) {
    if (entry.modo !== 'cantidad' || !entry.umbrales) {
      throw new SpriteError(`"${key}" no es un sprite de cantidad (modo ${entry.modo}).`);
    }
    return frameForQuantity(entry.umbrales, options.cantidad);
  }
  return assertFrame(key, entry, options.frame ?? 0);
}

/**
 * Mode of a sheet when the data does not carry one, with the rule of the design
 * system: durations make it an animation, thresholds a quantity sheet, and more
 * than one frame without either a variant sheet.
 */
export function spriteMode(
  frames: number,
  data: { durations?: readonly number[]; thresholds?: readonly number[] } = {},
): SpriteMode {
  if (frames <= 1) return 'estatico';
  if (data.durations) return 'animacion';
  if (data.thresholds) return 'cantidad';
  return 'variante';
}

/**
 * A frame larger than the 64 px game cell is not a game sprite but an illustration
 * (element icons are 100 px, Pokémon art 140): it scales smoothly to its drawn size
 * and never takes `image-rendering: pixelated` (spec 7.4.2, DS:guias/20).
 */
export function isIllustration(frame: readonly [number, number]): boolean {
  return Math.max(frame[0], frame[1]) > CELL * 2;
}

export type CellPlacement = {
  /** Side of the cell once scaled, in px. */
  size: number;
  left: number;
  top: number;
};

/**
 * Where a sprite sits inside its game cell (spec 7.4.3): a cell of 32, or 64 when a
 * frame is larger than 32, at integer scale `k` and centred on whole pixels.
 */
export function cellPlacement(frame: readonly [number, number], k: number): CellPlacement {
  const [width, height] = frame;
  const cell = Math.max(width, height) <= CELL ? CELL : CELL * 2;
  return {
    size: cell * k,
    left: Math.floor((cell - width) / 2) * k,
    top: Math.floor((cell - height) / 2) * k,
  };
}

export type TimelineStep = { frame: number; startMs: number; durationMs: number };

function scheduleOf(durations: readonly number[]): { totalMs: number; steps: TimelineStep[] } {
  let startMs = 0;
  const steps = durations.map((durationMs, frame) => {
    const step = { frame, startMs, durationMs };
    startMs += durationMs;
    return step;
  });
  return { totalMs: startMs, steps };
}

/** Per-frame schedule of an `animacion` sprite. */
export function animationTimeline(
  key: string,
  entry: SpriteEntry,
): { totalMs: number; steps: TimelineStep[] } {
  if (entry.modo !== 'animacion' || !entry.duracionMs) {
    throw new SpriteError(`"${key}" no es una animación (modo ${entry.modo}).`);
  }
  if (entry.duracionMs.length !== entry.frames) {
    throw new SpriteError(
      `"${key}": duracionMs tiene ${entry.duracionMs.length} valores y la hoja ${entry.frames} frames.`,
    );
  }
  entry.duracionMs.forEach((durationMs, frame) => {
    if (!Number.isInteger(durationMs) || durationMs < 1) {
      throw new SpriteError(`"${key}": duración inválida en el frame ${frame}: ${durationMs}.`);
    }
  });
  return scheduleOf(entry.duracionMs);
}

/** Frame visible `elapsedMs` after the animation starts. */
export function frameAt(key: string, entry: SpriteEntry, elapsedMs: number): number {
  const { totalMs, steps } = animationTimeline(key, entry);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  const time = entry.loop === false ? Math.min(elapsedMs, totalMs - 1) : elapsedMs % totalMs;
  return steps.findLast((step) => step.startMs <= time)?.frame ?? 0;
}

/** object-position (percent) that shows `frame` of an N-frame horizontal strip. */
export function frameObjectPosition(frames: number, frame: number): string {
  const x = frames > 1 ? (frame / (frames - 1)) * 100 : 0;
  return `${formatPercent(x)} 0%`;
}

function formatPercent(value: number): string {
  return `${Number(value.toFixed(4))}%`;
}

/**
 * Everything that decides a sheet's keyframes (spec 7.4.2): how many frames it has,
 * how long each one holds and whether it loops. The key plays no part, so two
 * registry entries that move the same way share one `@keyframes` block.
 */
export type AnimationSignature = {
  frames: number;
  durations: readonly number[];
  loop: boolean;
};

function assertSignature(signature: AnimationSignature): void {
  const { frames, durations } = signature;
  if (!Number.isInteger(frames) || frames < 1) {
    throw new SpriteError(`Firma de animación inválida: ${frames} fotograma(s).`);
  }
  if (durations.length !== frames) {
    throw new SpriteError(
      `Firma de animación inválida: ${durations.length} duraciones para ${frames} fotograma(s).`,
    );
  }
  durations.forEach((durationMs, frame) => {
    if (!Number.isInteger(durationMs) || durationMs < 1) {
      throw new SpriteError(
        `Firma de animación inválida: duración ${durationMs} en el fotograma ${frame}.`,
      );
    }
  });
}

/** Signature of an `animacion` entry of the registry. */
export function animationSignature(key: string, entry: SpriteEntry): AnimationSignature {
  animationTimeline(key, entry);
  return {
    frames: entry.frames,
    durations: entry.duracionMs ?? [],
    loop: entry.loop !== false,
  };
}

/**
 * CSS name of a signature's `@keyframes` (spec 7.4.2): `ac-sprite-<frames>-<durations
 * joined by ->`, with the suffix `-once` when the sheet does not loop. Every part is
 * a number, so the name is always a valid CSS identifier.
 */
export function animationName(signature: AnimationSignature): string {
  assertSignature(signature);
  const { frames, durations, loop } = signature;
  return `ac-sprite-${frames}-${durations.join('-')}${loop ? '' : '-once'}`;
}

/**
 * `@keyframes` of one signature. Each frame holds for its own duration
 * (`steps(1, end)`, the `step-end` of the design system) and the animation moves the
 * percentage object-position, so it is scale-independent. Motion only runs without
 * prefers-reduced-motion, so reduced-motion users keep frame 0 from the inline style.
 */
export function animationCss(signature: AnimationSignature): string {
  const name = animationName(signature);
  const { frames, durations, loop } = signature;
  const { totalMs, steps } = scheduleOf(durations);
  const body = steps
    .map(
      (step) =>
        `${formatPercent((step.startMs / totalMs) * 100)}{object-position:${frameObjectPosition(frames, step.frame)}}`,
    )
    .join('');
  const last = frameObjectPosition(frames, frames - 1);
  const iteration = loop ? 'infinite' : '1 forwards';
  return (
    `@keyframes ${name}{${body}100%{object-position:${last}}}` +
    `@media (prefers-reduced-motion:no-preference){` +
    `.ac-sprite[data-anim='${name}']` +
    `{animation:${name} ${totalMs}ms steps(1,end) ${iteration}}}`
  );
}

/** Every distinct animation signature of the registry, keyed by its `@keyframes` name. */
function registrySignatures(registry: SpriteRegistry): Map<string, AnimationSignature> {
  const signatures = new Map<string, AnimationSignature>();
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.modo !== 'animacion') continue;
    const signature = animationSignature(key, entry);
    const name = animationName(signature);
    if (!signatures.has(name)) signatures.set(name, signature);
  }
  return signatures;
}

/** One `@keyframes` block per distinct animation signature of the registry. */
export function registryAnimationCss(registry: SpriteRegistry): string {
  return [...registrySignatures(registry).values()].map(animationCss).join('\n');
}

/** The `@keyframes` names of each registry, read once per build. */
const registeredNames = new WeakMap<SpriteRegistry, ReadonlySet<string>>();

/**
 * Fails when a sheet asks for an animation `SpriteStyles.astro` does not write (spec
 * 7.4.2: «una firma que no está en el registro falla el build»). Without it the sheet
 * would carry a `data-anim` with no `@keyframes` and silently rest on frame 0.
 */
export function assertRegisteredAnimation(registry: SpriteRegistry, name: string): void {
  let names = registeredNames.get(registry);
  if (names === undefined) {
    names = new Set(registrySignatures(registry).keys());
    registeredNames.set(registry, names);
  }
  if (names.has(name)) return;
  throw new SpriteError(
    `La animación "${name}" no es la de ninguna entrada de sprites.json: sus fotogramas y ` +
      'duraciones salen del registro, no del código (7.4.2).',
  );
}

/**
 * The half of `SpriteProps` that comes from the registry (spec 7.4.1, DP2): the
 * adapter turns a key and its options into these, and whoever composes the page adds
 * the presentation props (`cell`, `alt`, `bounce`, `loading`). No component reads the
 * registry itself and none writes a sprite URL.
 */
export type SpriteData = {
  src: string;
  size: [number, number];
  frames: number;
  mode: SpriteMode;
  /** Frame of a `variante` sheet. */
  frame?: number;
  /** Stack size of a `cantidad` sheet; the composer may change it per render. */
  quantity?: number;
  thresholds?: number[];
  /** Only when the animation was asked for: without them the sheet rests on frame 0. */
  durations?: number[];
  loop?: boolean;
  scale?: number;
  smooth?: true;
};

/**
 * Sprite keys the code names by hand (spec 3.13 and 9.5.1). The owner adds them to
 * the registry (D-011); until then `spriteOrNull` answers `null` for these and only
 * these, so a missing one leaves an empty navigation cell or a missing-sprite mark
 * instead of failing the build.
 */
export const FIXED_SPRITE_KEYS: readonly string[] = [
  'ui/pokedolares',
  'ui/diamond',
  'ui/comercio/item',
  'outfits/5',
  'items/stones/fire-stone',
  'ui/inicio',
  'ui/indice/sistemas',
  'ui/indice/items',
  'ui/indice/actividades',
  'ui/indice/pokedex',
  'ui/herramientas/guild',
  'ui/herramientas/mapa',
  'ui/cambios',
];

const fixedSpriteKeys = new Set(FIXED_SPRITE_KEYS);

function assertScale(key: string, escala: number): void {
  if (!Number.isInteger(escala) || escala < 1 || escala > 16) {
    throw new SpriteError(`Escala inválida para "${key}": ${escala}. Usa un entero de 1 a 16.`);
  }
}

function fileOf(key: string, entry: SpriteEntry, direccion?: SpriteDirection): string {
  if (!direccion) return entry.archivo;
  if (!entry.direcciones) throw new SpriteError(`"${key}" no tiene direcciones.`);
  return entry.direcciones[direccion];
}

/** The adapter: a registry key and its options as the props of `Sprite` (spec 7.4.1). */
export function spriteData(
  registry: SpriteRegistry,
  key: string,
  options: SpriteOptions = {},
): SpriteData {
  const entry = getSpriteEntry(registry, key);
  const escala = options.escala ?? 1;
  assertScale(key, escala);

  const data: SpriteData = {
    src: spriteUrl(fileOf(key, entry, options.direccion)),
    size: [entry.frame[0], entry.frame[1]],
    frames: entry.frames,
    mode: entry.modo,
  };
  if (escala !== 1) data.scale = escala;
  if (isIllustration(entry.frame)) data.smooth = true;

  if (options.animado) {
    // Fails the build when the entry cannot animate, as it does for a bad frame.
    animationTimeline(key, entry);
    data.durations = [...(entry.duracionMs ?? [])];
    if (entry.loop === false) data.loop = false;
    return data;
  }

  const frame = resolveFrame(key, entry, options);
  if (entry.modo === 'cantidad' && entry.umbrales) {
    data.thresholds = [...entry.umbrales];
    if (options.cantidad !== undefined) data.quantity = options.cantidad;
    return data;
  }
  if (frame !== 0) data.frame = frame;
  return data;
}

/**
 * The adapter for the fixed keys of spec 3.13 and for a registry field that may be
 * `null` (an element with no icon yet): both answer `null`, which the caller draws as
 * an empty cell or a missing-sprite mark. Any other unknown key still fails the build
 * (spec 7.4.1).
 */
export function spriteOrNull(
  registry: SpriteRegistry,
  key: string | null | undefined,
  options: SpriteOptions = {},
): SpriteData | null {
  if (key === null || key === undefined) return null;
  if (!Object.hasOwn(registry, key) && fixedSpriteKeys.has(key)) return null;
  return spriteData(registry, key, options);
}

/** Everything a component needs to render one sprite as an <img>. */
export function resolveSprite(
  registry: SpriteRegistry,
  key: string,
  options: SpriteOptions = {},
): ResolvedSprite {
  const entry = getSpriteEntry(registry, key);
  const escala = options.escala ?? 1;
  assertScale(key, escala);
  const archivo = fileOf(key, entry, options.direccion);
  let animation: string | null = null;
  let frame: number;
  if (options.animado) {
    animation = animationName(animationSignature(key, entry));
    frame = 0;
  } else {
    frame = resolveFrame(key, entry, options);
  }
  const [width, height] = entry.frame;
  return {
    key,
    src: spriteUrl(archivo),
    frame,
    width: width * escala,
    height: height * escala,
    objectPosition: frameObjectPosition(entry.frames, frame),
    aspectRatio: `${width} / ${height}`,
    animation,
  };
}

/** The documented placeholder of an item that has no sprite yet (docs/REGISTROS.md). */
export const ITEM_PLACEHOLDER_SPRITE = 'ui/comercio/item';

/**
 * An item's sprite as the list files carry it (items and Pokédex `datos.json`, their props):
 * `null` for the placeholder, so the list draws the missing-sprite mark of an item with no sprite
 * yet (R7) and the files do not repeat the same sprite a thousand times (§13.6, 400 KB).
 */
export function listItemSprite(
  registry: SpriteRegistry,
  key: string | null | undefined,
): SpriteData | null {
  return key === ITEM_PLACEHOLDER_SPRITE ? null : spriteOrNull(registry, key);
}
