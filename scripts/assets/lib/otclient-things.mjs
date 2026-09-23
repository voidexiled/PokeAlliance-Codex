// Read-only readers and encoders for OTClient-style `things` assets: the DAT
// metadata file, the SPR sprite file and the OTML/OTFI side files.
//
// The binary layout follows OTClient's ThingType::unserialize and SpriteManager
// (10.10+ attribute numbering, as written by ObjectBuilder), plus the 16-byte
// PokeAlliance attribute extension observed in the owner's decrypted DAT.
//
// Importing this module has no side effects. File access is read-only; this
// module never writes, decrypts or patches anything.

import { createHash } from 'node:crypto';
import { closeSync, createReadStream, openSync, readSync } from 'node:fs';
import * as zlib from 'node:zlib';

/** Pixel size of one DAT tile / SPR sprite. */
export const TILE_SIZE = 32;
const SPRITE_BYTES = TILE_SIZE * TILE_SIZE * 4;

/** DAT category order; items start at ID 100, the others at ID 1. */
export const DAT_CATEGORIES = Object.freeze(['items', 'outfits', 'effects', 'missiles']);

/** OTClient creature direction order for patternX. */
export const DIRECTION_NAMES = Object.freeze(['north', 'east', 'south', 'west']);

/** OTClient FrameGroupType values (only present when frame groups are enabled). */
export const FRAME_GROUP_NAMES = Object.freeze({ 0: 'idle', 1: 'moving' });

/** ASCII signature of the client's protected (encrypted) files. */
export const PROTECTED_SIGNATURE = 'PKA1';

/**
 * @typedef {object} ThingsFormat
 * @property {boolean} extended       Sprite IDs are u32 and the SPR count is u32.
 * @property {boolean} transparency   SPR colored pixels are RGBA (4 bytes) instead of RGB.
 * @property {boolean} frameDurations Enhanced animation data follows each animated frame group.
 * @property {boolean} frameGroups    Outfits carry a frame-group count and type byte.
 */

/**
 * Settings of the owner's ObjectBuilder-compatible export (see its things.otfi).
 * @type {Readonly<ThingsFormat>}
 */
export const DEFAULT_THINGS_FORMAT = Object.freeze({
  extended: true,
  transparency: true,
  frameDurations: false,
  frameGroups: false,
});

/**
 * @typedef {object} ThingAttribute
 * @property {number} raw           Attribute byte as stored in the DAT.
 * @property {number} otclientAttr  OTClient ThingAttr value after the 10.10 remap.
 * @property {string} name
 * @property {string} payloadHex    Raw payload bytes (empty for boolean flags).
 * @property {unknown} value        Decoded payload, or `true` for flags.
 */

/**
 * @typedef {object} PhaseDuration
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {object} FrameAnimation
 * @property {boolean} async
 * @property {number} loopCount
 * @property {number} startPhase
 * @property {PhaseDuration[]} durations
 */

/**
 * @typedef {object} FrameGroup
 * @property {number} index
 * @property {number | null} type   FrameGroupType byte, or null without frame groups.
 * @property {string} name          'default' without frame groups, else 'idle'/'moving'/...
 * @property {number} width         Tiles.
 * @property {number} height        Tiles.
 * @property {number | null} realSize  Raw "exact size" byte (only stored for multi-tile things).
 * @property {number} exactSize     OTClient m_exactSize in pixels.
 * @property {number} layers
 * @property {number} patternX      Directions for outfits.
 * @property {number} patternY      Addons for outfits.
 * @property {number} patternZ      Mount state for outfits.
 * @property {number} phases        Animation phases.
 * @property {FrameAnimation | null} animation
 * @property {number} spriteCount
 * @property {number[]} spriteIds   Empty when sprites were not kept for the category.
 */

/**
 * @typedef {object} ThingType
 * @property {string} category
 * @property {number} id
 * @property {number} offset        Byte offset of the thing in the DAT.
 * @property {number} byteLength
 * @property {ThingAttribute[]} attributes
 * @property {FrameGroup[]} frameGroups
 */

/** Error raised for malformed or unsupported input files. Messages are user-facing (Spanish). */
export class ThingsFormatError extends Error {}

/** Returns true when the buffer starts with the protected-file signature. */
export function hasProtectedSignature(buffer) {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === PROTECTED_SIGNATURE;
}

/** Reads up to `length` leading bytes of a file (read-only). */
export function readFileHead(path, length = 4) {
  const fd = openSync(path, 'r');
  try {
    const head = Buffer.alloc(length);
    const read = readSync(fd, head, 0, length, 0);
    return head.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

/** Throws when a file is a protected client file; only owner-decrypted inputs are supported. */
export function assertNotProtected(path, label = 'El archivo') {
  if (hasProtectedSignature(readFileHead(path, 4))) {
    throw new ThingsFormatError(
      `${label} (${path}) empieza con la firma PKA1: es un archivo protegido del cliente. ` +
        'Esta herramienta solo admite archivos ya descifrados por el propietario y nunca intenta descifrarlos.',
    );
  }
}

/** Little-endian cursor over a Buffer with bounds checks. */
export class ByteReader {
  /** @param {Buffer} buffer */
  constructor(buffer, offset = 0) {
    this.buffer = buffer;
    this.offset = offset;
  }
  /** @param {number} bytes */
  ensure(bytes) {
    if (this.offset + bytes > this.buffer.length)
      throw new ThingsFormatError(`Fin inesperado del DAT en el byte ${this.offset}`);
  }
  u8() {
    this.ensure(1);
    return this.buffer[this.offset++];
  }
  i8() {
    this.ensure(1);
    return this.buffer.readInt8(this.offset++);
  }
  u16() {
    this.ensure(2);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }
  i16() {
    this.ensure(2);
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }
  u32() {
    this.ensure(4);
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }
  i32() {
    this.ensure(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }
  /** Length-prefixed (u16) Latin-1 string, as used by the market attribute. */
  string() {
    const length = this.u16();
    this.ensure(length);
    const value = this.buffer.toString('latin1', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
  /** @param {number} bytes */
  skip(bytes) {
    this.ensure(bytes);
    this.offset += bytes;
  }
}

/**
 * @param {ByteReader} reader
 * @returns {number[]}
 */
function readInt16Points(reader) {
  return Array.from({ length: 8 }, () => reader.i16());
}

/**
 * @typedef {object} AttributeDefinition
 * @property {string} name
 * @property {(reader: ByteReader) => unknown} [read]  Payload decoder; absent for flags.
 */

/**
 * Attribute table keyed by the raw DAT byte (10.10+ numbering). Entries without
 * `read` are boolean flags with no payload. Unknown bytes are also treated as
 * flags; a later misalignment is caught by the end-of-file check in parseDat.
 * @type {ReadonlyMap<number, AttributeDefinition>}
 */
export const THING_ATTRIBUTES = new Map(
  /** @type {[number, AttributeDefinition][]} */ ([
    [0, { name: 'ground', read: (r) => ({ speed: r.u16() }) }],
    [1, { name: 'groundBorder' }],
    [2, { name: 'onBottom' }],
    [3, { name: 'onTop' }],
    [4, { name: 'container' }],
    [5, { name: 'stackable' }],
    [6, { name: 'forceUse' }],
    [7, { name: 'multiUse' }],
    [8, { name: 'writable', read: (r) => ({ maxTextLength: r.u16() }) }],
    [9, { name: 'writableOnce', read: (r) => ({ maxTextLength: r.u16() }) }],
    [10, { name: 'fluidContainer' }],
    [11, { name: 'splash' }],
    [12, { name: 'notWalkable' }],
    [13, { name: 'notMoveable' }],
    [14, { name: 'blockProjectile' }],
    [15, { name: 'notPathable' }],
    [16, { name: 'noMoveAnimation' }],
    [17, { name: 'pickupable' }],
    [18, { name: 'hangable' }],
    [19, { name: 'hookSouth' }],
    [20, { name: 'hookEast' }],
    [21, { name: 'rotateable' }],
    [22, { name: 'light', read: (r) => ({ intensity: r.u16(), color: r.u16() }) }],
    [23, { name: 'dontHide' }],
    [24, { name: 'translucent' }],
    // OTClient reads two u16; negative offsets are stored as two's complement.
    [25, { name: 'displacement', read: (r) => ({ x: r.i16(), y: r.i16() }) }],
    [26, { name: 'elevation', read: (r) => ({ height: r.u16() }) }],
    [27, { name: 'lyingCorpse' }],
    [28, { name: 'animateAlways' }],
    [29, { name: 'minimapColor', read: (r) => ({ color: r.u16() }) }],
    // Tibia "lens help"; PokeAlliance outfits use values such as 50..400 (meaning unconfirmed).
    [30, { name: 'lensHelp', read: (r) => ({ value: r.u16() }) }],
    [31, { name: 'fullGround' }],
    [32, { name: 'look' }],
    [33, { name: 'cloth', read: (r) => ({ slot: r.u16() }) }],
    [
      34,
      {
        name: 'market',
        read: (r) => ({
          category: r.u16(),
          tradeAs: r.u16(),
          showAs: r.u16(),
          name: r.string(),
          restrictVocation: r.u16(),
          requiredLevel: r.u16(),
        }),
      },
    ],
    [35, { name: 'usable', read: (r) => ({ action: r.u16() }) }],
    [36, { name: 'wrapable' }],
    [37, { name: 'unwrapable' }],
    [38, { name: 'topEffect' }],
    // PokeAlliance extension: 16 bytes. In the observed DAT it only appears on
    // outfits and never together with `displacement` (raw 25); decoded as four
    // signed x/y pairs, hypothetically one offset per direction (N, E, S, W).
    [
      39,
      {
        name: 'pokeAllianceDirectionalOffsets',
        read: (r) => {
          const values = readInt16Points(r);
          return {
            int16: values,
            hypothesis: 'per-direction x/y offsets (north, east, south, west); meaning unconfirmed',
            north: { x: values[0], y: values[1] },
            east: { x: values[2], y: values[3] },
            south: { x: values[4], y: values[5] },
            west: { x: values[6], y: values[7] },
          };
        },
      },
    ],
    // Same 16-byte width as raw 39 in the earlier preview extractor; not observed
    // in the 2026-09 DAT.
    [42, { name: 'pokeAllianceExtension42', read: (r) => ({ int16: readInt16Points(r) }) }],
    [253, { name: 'floorChange' }],
  ]),
);

/** OTClient remaps 10.10+ attribute bytes: 16 becomes NoMoveAnimation (253), >16 shift down by one. */
export function otclientAttributeId(raw) {
  if (raw === 16) return 253;
  return raw > 16 ? raw - 1 : raw;
}

/**
 * Reads one attribute payload.
 * @param {ByteReader} reader
 * @param {number} raw
 * @returns {ThingAttribute}
 */
function readAttribute(reader, raw) {
  const definition = THING_ATTRIBUTES.get(raw);
  const start = reader.offset;
  const value = definition?.read ? definition.read(reader) : true;
  return {
    raw,
    otclientAttr: otclientAttributeId(raw),
    name: definition?.name ?? `unknown0x${raw.toString(16).padStart(2, '0')}`,
    payloadHex: reader.buffer.toString('hex', start, reader.offset),
    value,
  };
}

/** Upper bound for sprites per frame group; only a sanity check against misaligned reads. */
const MAX_GROUP_SPRITES = 1 << 20;

/**
 * Reads one ThingType at the reader's offset.
 * @param {ByteReader} reader
 * @param {{ category: string, id: number, format?: ThingsFormat, keepSprites?: boolean }} options
 * @returns {ThingType}
 */
export function readThingType(
  reader,
  { category, id, format = DEFAULT_THINGS_FORMAT, keepSprites = true },
) {
  const offset = reader.offset;
  /** @type {ThingAttribute[]} */
  const attributes = [];
  let terminated = false;
  for (let index = 0; index < 255; index++) {
    const raw = reader.u8();
    if (raw === 0xff) {
      terminated = true;
      break;
    }
    attributes.push(readAttribute(reader, raw));
  }
  if (!terminated)
    throw new ThingsFormatError(`Atributos del DAT sin terminar en el byte ${reader.offset}`);

  const hasFrameGroups = category === 'outfits' && format.frameGroups;
  const groupCount = hasFrameGroups ? reader.u8() : 1;
  /** @type {FrameGroup[]} */
  const frameGroups = [];
  const usedNames = new Set();
  for (let index = 0; index < groupCount; index++) {
    const type = hasFrameGroups ? reader.u8() : null;
    const width = reader.u8();
    const height = reader.u8();
    let realSize = null;
    let exactSize = TILE_SIZE;
    if (width > 1 || height > 1) {
      realSize = reader.u8();
      exactSize = Math.min(realSize, Math.max(width, height) * TILE_SIZE);
    }
    const layers = reader.u8();
    const patternX = reader.u8();
    const patternY = reader.u8();
    const patternZ = reader.u8();
    const phases = reader.u8();
    const spriteCount = width * height * layers * patternX * patternY * patternZ * phases;
    if (!spriteCount || spriteCount > MAX_GROUP_SPRITES) {
      throw new ThingsFormatError(
        `Dimensiones inválidas en el byte ${reader.offset}: ` +
          [width, height, layers, patternX, patternY, patternZ, phases].join(','),
      );
    }
    /** @type {FrameAnimation | null} */
    let animation = null;
    if (phases > 1 && format.frameDurations) {
      const async = reader.u8() === 0;
      const loopCount = reader.i32();
      const startPhase = reader.i8();
      const durations = Array.from({ length: phases }, () => ({
        min: reader.u32(),
        max: reader.u32(),
      }));
      animation = { async, loopCount, startPhase, durations };
    }
    /** @type {number[]} */
    let spriteIds = [];
    if (keepSprites) {
      spriteIds = new Array(spriteCount);
      for (let sprite = 0; sprite < spriteCount; sprite++)
        spriteIds[sprite] = format.extended ? reader.u32() : reader.u16();
    } else {
      reader.skip(spriteCount * (format.extended ? 4 : 2));
    }
    let name = type === null ? 'default' : (FRAME_GROUP_NAMES[type] ?? `group${type}`);
    if (usedNames.has(name)) name = `${name}-${index}`;
    usedNames.add(name);
    frameGroups.push({
      index,
      type,
      name,
      width,
      height,
      realSize,
      exactSize,
      layers,
      patternX,
      patternY,
      patternZ,
      phases,
      animation,
      spriteCount,
      spriteIds,
    });
  }
  return { category, id, offset, byteLength: reader.offset - offset, attributes, frameGroups };
}

/**
 * @typedef {object} ParsedDat
 * @property {number} signature
 * @property {{ items: number, outfits: number, effects: number, missiles: number }} counts
 * @property {Record<string, Map<number, ThingType>>} things  Only the kept categories.
 * @property {number} byteLength
 * @property {number} endOffset
 * @property {number} trailingBytes  Bytes left after the last missile (0 for a well-aligned parse).
 * @property {ThingsFormat} format
 */

/**
 * Parses a complete DAT buffer. Every category is walked (the file is
 * sequential), but ThingTypes are only kept for the requested categories.
 * @param {Buffer} buffer
 * @param {{ format?: ThingsFormat, keep?: string[] }} [options]
 * @returns {ParsedDat}
 */
export function parseDat(buffer, { format = DEFAULT_THINGS_FORMAT, keep = ['outfits'] } = {}) {
  if (hasProtectedSignature(buffer)) {
    throw new ThingsFormatError(
      'El DAT empieza con la firma PKA1 (archivo protegido). Solo se admiten archivos ya descifrados por el propietario.',
    );
  }
  const reader = new ByteReader(buffer);
  const signature = reader.u32();
  const counts = {
    items: reader.u16(),
    outfits: reader.u16(),
    effects: reader.u16(),
    missiles: reader.u16(),
  };
  /** @type {Record<string, Map<number, ThingType>>} */
  const things = {};
  for (const category of keep) things[category] = new Map();
  for (const category of DAT_CATEGORIES) {
    const firstId = category === 'items' ? 100 : 1;
    const store = things[category];
    const lastId = counts[/** @type {keyof typeof counts} */ (category)];
    for (let id = firstId; id <= lastId; id++) {
      const start = reader.offset;
      let thing;
      try {
        thing = readThingType(reader, { category, id, format, keepSprites: Boolean(store) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ThingsFormatError(`DAT ${category} ${id} (byte ${start}): ${message}`, {
          cause: error,
        });
      }
      if (store) store.set(id, thing);
    }
  }
  return {
    signature,
    counts,
    things,
    byteLength: buffer.length,
    endOffset: reader.offset,
    trailingBytes: buffer.length - reader.offset,
    format: { ...format },
  };
}

/**
 * @typedef {object} OtmlNode
 * @property {string | null} tag
 * @property {string | null} value
 * @property {number} line
 * @property {OtmlNode[]} children
 */

/**
 * Minimal indentation-based OTML parser (enough for things.otml / things.otfi).
 * `tag: value`, bare `tag` (with children) and `tag value` lines are supported.
 * @param {string} text
 * @returns {OtmlNode}
 */
export function parseOtml(text) {
  /** @type {OtmlNode} */
  const root = { tag: null, value: null, line: 0, children: [] };
  /** @type {{ indent: number, node: OtmlNode }[]} */
  const stack = [{ indent: -1, node: root }];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const content = rawLine.trim();
    if (!content || content.startsWith('//')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    let tag;
    let value;
    const colon = content.indexOf(':');
    if (colon > 0) {
      tag = content.slice(0, colon).trim();
      value = content.slice(colon + 1).trim() || null;
    } else {
      const match = /^(\S+)\s+(.+)$/.exec(content);
      tag = match ? match[1] : content;
      value = match ? match[2] : null;
    }
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    /** @type {OtmlNode} */
    const node = { tag, value, line: index + 1, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent, node });
  });
  return root;
}

/** Decodes an OTML scalar: booleans, numbers and space-separated number lists. */
export function decodeOtmlValue(value) {
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (/^-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?)+$/.test(value)) return value.split(/\s+/).map(Number);
  return value;
}

/**
 * Converts an OTML node's children into a plain object. Repeated tags become arrays.
 * @param {OtmlNode} node
 * @returns {Record<string, unknown>}
 */
export function otmlNodeToObject(node) {
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const child of node.children) {
    const key = child.tag ?? '';
    const value = child.children.length
      ? {
          ...(child.value === null ? {} : { value: decodeOtmlValue(child.value) }),
          ...otmlNodeToObject(child),
        }
      : decodeOtmlValue(child.value);
    if (Object.hasOwn(result, key)) {
      const previous = result[key];
      result[key] =
        Array.isArray(previous) && previous.length && child.children.length === 0
          ? [...previous, value]
          : [previous, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Indexes one things.otml section (e.g. `creatures` for outfits) by thing ID.
 * @param {OtmlNode} tree
 * @param {string} section
 * @returns {Map<number, Record<string, unknown>>}
 */
export function indexOtmlSection(tree, section) {
  const node = tree.children.find((child) => child.tag === section);
  /** @type {Map<number, Record<string, unknown>>} */
  const index = new Map();
  if (!node) return index;
  for (const child of node.children) {
    const id = Number(child.tag);
    if (Number.isSafeInteger(id))
      index.set(id, { ...(index.get(id) ?? {}), ...otmlNodeToObject(child) });
  }
  return index;
}

/**
 * Reads ObjectBuilder's things.otfi (`DatSpr` block) into a format description.
 * @param {string} text
 * @returns {{ format: ThingsFormat, values: Record<string, unknown> }}
 */
export function parseOtfi(text) {
  const tree = parseOtml(text);
  const block = tree.children.find((child) => child.tag === 'DatSpr') ?? tree;
  const values = otmlNodeToObject(block);
  /** @type {ThingsFormat} */
  const format = { ...DEFAULT_THINGS_FORMAT };
  /** @type {[keyof ThingsFormat, string][]} */
  const keys = [
    ['extended', 'extended'],
    ['transparency', 'transparency'],
    ['frameDurations', 'frame-durations'],
    ['frameGroups', 'frame-groups'],
  ];
  for (const [key, otfiKey] of keys) {
    if (typeof values[otfiKey] === 'boolean')
      format[key] = /** @type {boolean} */ (values[otfiKey]);
  }
  return { format, values };
}

/** Reads exactly `length` bytes at `position`; throws on a short read. */
function readExactly(fd, buffer, offset, length, position) {
  let done = 0;
  while (done < length) {
    const read = readSync(fd, buffer, offset + done, length - done, position + done);
    if (read === 0)
      throw new ThingsFormatError(`Fin inesperado del SPR en el byte ${position + done}`);
    done += read;
  }
}

/**
 * Random-access SPR reader backed by a file descriptor. Only the header and
 * the sprite address table (4 bytes per sprite) are held in memory.
 */
export class SpriteFile {
  /**
   * @param {number} fd
   * @param {{ path: string, signature: number, count: number, headerSize: number, addresses: Buffer, transparency: boolean }} info
   */
  constructor(fd, info) {
    this.fd = fd;
    this.path = info.path;
    this.signature = info.signature;
    this.count = info.count;
    this.headerSize = info.headerSize;
    this.addresses = info.addresses;
    this.transparency = info.transparency;
    this.header = Buffer.alloc(5);
    this.data = Buffer.alloc(65535);
  }

  /**
   * @param {string} path
   * @param {{ extended?: boolean, transparency?: boolean }} [format]
   */
  static open(path, { extended = true, transparency = true } = {}) {
    const fd = openSync(path, 'r');
    try {
      const head = Buffer.alloc(8);
      readExactly(fd, head, 0, extended ? 8 : 6, 0);
      if (hasProtectedSignature(head)) {
        throw new ThingsFormatError(
          `El SPR (${path}) empieza con la firma PKA1 (archivo protegido). Solo se admiten archivos ya descifrados por el propietario.`,
        );
      }
      const signature = head.readUInt32LE(0);
      const count = extended ? head.readUInt32LE(4) : head.readUInt16LE(4);
      const headerSize = extended ? 8 : 6;
      const addresses = Buffer.alloc(count * 4);
      if (count) readExactly(fd, addresses, 0, addresses.length, headerSize);
      return new SpriteFile(fd, { path, signature, count, headerSize, addresses, transparency });
    } catch (error) {
      closeSync(fd);
      throw error;
    }
  }

  /**
   * Decodes one 32x32 sprite into a new RGBA buffer. ID 0 and unset addresses are transparent.
   * @param {number} id
   * @returns {Buffer}
   */
  readSprite(id) {
    const output = Buffer.alloc(SPRITE_BYTES);
    if (id === 0) return output;
    if (!Number.isSafeInteger(id) || id < 0 || id > this.count)
      throw new ThingsFormatError(`ID de sprite inválido ${id} (el SPR tiene ${this.count})`);
    const address = this.addresses.readUInt32LE((id - 1) * 4);
    if (!address) return output;
    readExactly(this.fd, this.header, 0, 5, address);
    const size = this.header.readUInt16LE(3);
    readExactly(this.fd, this.data, 0, size, address + 5);
    const data = this.data;
    const stride = this.transparency ? 4 : 3;
    let input = 0;
    let pixel = 0;
    while (input < size) {
      if (input + 4 > size) throw new ThingsFormatError(`Sprite ${id} truncado`);
      const transparent = data.readUInt16LE(input);
      const colored = data.readUInt16LE(input + 2);
      input += 4;
      pixel += transparent;
      if (pixel + colored > TILE_SIZE * TILE_SIZE || input + colored * stride > size)
        throw new ThingsFormatError(`Secuencia inválida en el sprite ${id}`);
      if (stride === 4) {
        data.copy(output, pixel * 4, input, input + colored * 4);
      } else {
        for (let index = 0; index < colored; index++) {
          const target = (pixel + index) * 4;
          output[target] = data[input + index * 3];
          output[target + 1] = data[input + index * 3 + 1];
          output[target + 2] = data[input + index * 3 + 2];
          output[target + 3] = 255;
        }
      }
      input += colored * stride;
      pixel += colored;
    }
    return output;
  }

  close() {
    closeSync(this.fd);
  }
}

/**
 * OTClient ThingType::getSpriteIndex for one tile of one frame.
 * @param {FrameGroup} group
 * @param {{ tileX?: number, tileY?: number, layer?: number, x?: number, y?: number, z?: number, phase?: number }} position
 */
export function spriteIndex(
  group,
  { tileX = 0, tileY = 0, layer = 0, x = 0, y = 0, z = 0, phase = 0 },
) {
  return (
    ((((((phase % group.phases) * group.patternZ + z) * group.patternY + y) * group.patternX + x) *
      group.layers +
      layer) *
      group.height +
      tileY) *
      group.width +
    tileX
  );
}

/**
 * @typedef {object} ComposedFrame
 * @property {Buffer} pixels   RGBA, width * height * 4.
 * @property {number} width    Pixels.
 * @property {number} height   Pixels.
 * @property {number[]} spriteIds  Tile sprite IDs, index = tileY * group.width + tileX
 *                                 (tile 0,0 is drawn at the bottom-right corner).
 */

/**
 * Composes one frame of one layer. Tiles are placed like OTClient draws them:
 * tile (0,0) is the bottom-right 32x32 block and tiles grow to the top-left.
 * @param {FrameGroup} group
 * @param {{ layer?: number, x?: number, y?: number, z?: number, phase?: number }} frame
 * @param {(id: number) => Buffer} readSprite
 * @returns {ComposedFrame}
 */
export function composeFrame(group, frame, readSprite) {
  const width = group.width * TILE_SIZE;
  const height = group.height * TILE_SIZE;
  const pixels = Buffer.alloc(width * height * 4);
  const spriteIds = [];
  for (let tileY = 0; tileY < group.height; tileY++) {
    for (let tileX = 0; tileX < group.width; tileX++) {
      const id = group.spriteIds[spriteIndex(group, { ...frame, tileX, tileY })];
      spriteIds.push(id);
      if (!id) continue;
      const sprite = readSprite(id);
      const destX = (group.width - tileX - 1) * TILE_SIZE;
      const destY = (group.height - tileY - 1) * TILE_SIZE;
      for (let row = 0; row < TILE_SIZE; row++) {
        sprite.copy(
          pixels,
          ((destY + row) * width + destX) * 4,
          row * TILE_SIZE * 4,
          (row + 1) * TILE_SIZE * 4,
        );
      }
    }
  }
  return { pixels, width, height, spriteIds };
}

/** True when every pixel has alpha 0. */
export function isFullyTransparent(pixels) {
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) return false;
  return true;
}

/** Nearest-neighbour integer upscale of an RGBA buffer. */
export function scalePixels(pixels, width, height, factor) {
  if (factor === 1) return pixels;
  const scaledWidth = width * factor;
  const output = Buffer.alloc(scaledWidth * height * factor * 4);
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(scaledWidth * 4);
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      for (let repeat = 0; repeat < factor; repeat++)
        pixels.copy(row, (x * factor + repeat) * 4, source, source + 4);
    }
    for (let repeat = 0; repeat < factor; repeat++)
      row.copy(output, (y * factor + repeat) * scaledWidth * 4);
  }
  return output;
}

/** Copies an RGBA block into a larger RGBA canvas (no blending). */
export function blitPixels(target, targetWidth, source, sourceWidth, sourceHeight, destX, destY) {
  for (let row = 0; row < sourceHeight; row++) {
    source.copy(
      target,
      ((destY + row) * targetWidth + destX) * 4,
      row * sourceWidth * 4,
      (row + 1) * sourceWidth * 4,
    );
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

/** CRC-32 (PNG polynomial) over several buffers. Uses zlib's native CRC when available. */
export function crc32(...buffers) {
  if (typeof zlib.crc32 === 'function')
    return buffers.reduce((crc, buffer) => zlib.crc32(buffer, crc), 0) >>> 0;
  let crc = 0xffffffff;
  for (const buffer of buffers)
    for (let index = 0; index < buffer.length; index++)
      crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(name, data));
  return Buffer.concat([length, name, data, checksum]);
}

export const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

/**
 * Minimal PNG encoder: 8-bit RGBA, filter 0 on every row, one IDAT (zlib level 9).
 * Output is byte-identical to the original preview extractor's encoder.
 * @param {Buffer} pixels
 * @param {number} width
 * @param {number} height
 */
export function encodePng(pixels, width, height) {
  if (pixels.length !== width * height * 4)
    throw new RangeError(`Tamaño de píxeles ${pixels.length} no coincide con ${width}x${height}`);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const scanlines = Buffer.alloc(height * (stride + 1));
  for (let row = 0; row < height; row++)
    pixels.copy(scanlines, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Largest IDAT chunk written by the streaming encoder (PNG allows several). */
const MAX_IDAT_BYTES = 1 << 24;

/**
 * Streaming PNG encoder for large images (sprite sheets): rows are upscaled
 * (nearest neighbour, integer `scale`) and fed to zlib one at a time, so the
 * full-size RGBA image and its scanlines are never held in memory. Decodes to
 * the same pixels as `encodePng(scalePixels(pixels, ...), ...)`; the compressed
 * bytes may differ. 8-bit RGBA, filter 0, zlib level 9.
 * @param {Buffer} pixels  Unscaled RGBA.
 * @param {number} width   Unscaled width.
 * @param {number} height  Unscaled height.
 * @param {{ scale?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function encodePngStream(pixels, width, height, { scale = 1 } = {}) {
  if (pixels.length !== width * height * 4)
    throw new RangeError(`Tamaño de píxeles ${pixels.length} no coincide con ${width}x${height}`);
  if (!Number.isInteger(scale) || scale < 1) throw new RangeError(`Escala inválida ${scale}`);
  const outWidth = width * scale;
  const outHeight = height * scale;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(outWidth, 0);
  ihdr.writeUInt32BE(outHeight, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const deflate = zlib.createDeflate({ level: 9 });
  /** @type {Buffer[]} */
  const compressed = [];
  deflate.on('data', (chunk) => compressed.push(chunk));
  const finished = new Promise((resolve, reject) => {
    deflate.on('end', resolve);
    deflate.on('error', reject);
  });
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    // Filter byte 0 followed by the upscaled row.
    const line = Buffer.alloc(outWidth * 4 + 1);
    for (let x = 0; x < width; x++) {
      const source = y * stride + x * 4;
      for (let repeat = 0; repeat < scale; repeat++)
        pixels.copy(line, 1 + (x * scale + repeat) * 4, source, source + 4);
    }
    for (let repeat = 0; repeat < scale; repeat++) {
      if (!deflate.write(line))
        await new Promise((resolve) => deflate.once('drain', () => resolve(undefined)));
    }
  }
  deflate.end();
  await finished;
  const data = Buffer.concat(compressed);
  const idat = [];
  for (let offset = 0; offset < data.length || offset === 0; offset += MAX_IDAT_BYTES)
    idat.push(pngChunk('IDAT', data.subarray(offset, offset + MAX_IDAT_BYTES)));
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    ...idat,
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Decodes an 8-bit RGBA, non-interlaced PNG (all five row filters). Used to
 * verify the encoder's output; other PNG flavours are rejected.
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, pixels: Buffer }}
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE))
    throw new ThingsFormatError('Firma PNG inválida');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expected = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(buffer.subarray(offset + 4, offset + 8), data) !== expected)
      throw new ThingsFormatError(`CRC inválido en el bloque ${type}`);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0)
        throw new ThingsFormatError('Solo se decodifica PNG RGBA de 8 bits sin entrelazado');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  if (raw.length !== height * (stride + 1))
    throw new ThingsFormatError('Datos PNG con longitud inesperada');
  const pixels = Buffer.alloc(height * stride);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let index = 0; index < stride; index++) {
      const left = index >= 4 ? pixels[row * stride + index - 4] : 0;
      const up = row > 0 ? pixels[(row - 1) * stride + index] : 0;
      const upLeft = row > 0 && index >= 4 ? pixels[(row - 1) * stride + index - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distanceLeft = Math.abs(estimate - left);
        const distanceUp = Math.abs(estimate - up);
        const distanceUpLeft = Math.abs(estimate - upLeft);
        predictor =
          distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft
            ? left
            : distanceUp <= distanceUpLeft
              ? up
              : upLeft;
      } else if (filter !== 0) throw new ThingsFormatError(`Filtro PNG desconocido ${filter}`);
      pixels[row * stride + index] = (line[index] + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
}

/** Hex SHA-256 of a buffer or string. */
export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Streams a file through SHA-256 (suitable for the ~1 GB SPR).
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function sha256File(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 }))
    digest.update(chunk);
  return digest.digest('hex');
}
