import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const repositoryRoot = process.cwd();
const sourcePath = process.argv[2];
const outputDirectory = path.resolve(repositoryRoot, 'public/data/map/otmm');
const stagingPath = path.resolve(repositoryRoot, 'data/staging/local-otmm-preview.json');
const targetFloors = new Set([1, 3, 4, 5, 6, 7, 8, 9]);
const blockDimension = 64;
const tileBytes = 3;
const blockBytes = blockDimension * blockDimension * tileBytes;
const downsample = 8;

if (!sourcePath) {
  throw new Error('Usage: node scripts/map/extract-otmm-preview.mjs <path-to-otmm>');
}

const sourceBuffer = fs.readFileSync(sourcePath);
const sourceStat = fs.statSync(sourcePath);
const sourceHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex').toUpperCase();
const levels = new Map();

function getLevel(z) {
  if (!levels.has(z))
    levels.set(z, { blocks: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  return levels.get(z);
}

function colorFrom8Bit(color) {
  if (color <= 0 || color >= 216) return [0, 0, 0];
  return [(Math.floor(color / 36) % 6) * 51, (Math.floor(color / 6) % 6) * 51, (color % 6) * 51];
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([typeBuffer, data]);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  payload.copy(result, 4);
  result.writeUInt32BE(crc32(payload), 8 + data.length);
  return result;
}

function encodePng(width, height, rgba) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0;
    rgba.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

if (sourceBuffer.subarray(0, 4).toString('ascii') !== 'OTMM') {
  throw new Error('The selected file does not have the OTMM signature.');
}

const dataStart = sourceBuffer.readUInt16LE(4);
const version = sourceBuffer.readUInt16LE(6);
const descriptionLength = sourceBuffer.readUInt16LE(12);
const description = sourceBuffer.subarray(14, 14 + descriptionLength).toString('utf8');
let offset = dataStart;
let recordCount = 0;
let parsedBytes = dataStart;

while (offset + 5 <= sourceBuffer.length) {
  const x = sourceBuffer.readUInt16LE(offset);
  const y = sourceBuffer.readUInt16LE(offset + 2);
  const z = sourceBuffer[offset + 4];
  offset += 5;

  if (x === 65535 || y === 65535 || z === 255) break;
  if (offset + 2 > sourceBuffer.length)
    throw new Error('OTMM record ended before its compressed length.');

  const compressedLength = sourceBuffer.readUInt16LE(offset);
  offset += 2;
  const compressedEnd = offset + compressedLength;
  if (compressedEnd > sourceBuffer.length) throw new Error('OTMM record exceeds the source file.');

  const block = zlib.inflateSync(sourceBuffer.subarray(offset, compressedEnd));
  if (block.length !== blockBytes) {
    throw new Error(`Unexpected OTMM block size: ${block.length}; expected ${blockBytes}.`);
  }
  offset = compressedEnd;
  recordCount += 1;

  if (targetFloors.has(z)) {
    const level = getLevel(z);
    level.blocks.push({ x, y, data: block });
    level.minX = Math.min(level.minX, x);
    level.minY = Math.min(level.minY, y);
    level.maxX = Math.max(level.maxX, x + blockDimension - 1);
    level.maxY = Math.max(level.maxY, y + blockDimension - 1);
  }
  parsedBytes = offset;
}

fs.mkdirSync(outputDirectory, { recursive: true });
const manifestFloors = [];

for (const z of [...targetFloors].sort((a, b) => a - b)) {
  const level = levels.get(z);
  if (!level) continue;

  const width = Math.ceil((level.maxX - level.minX + 1) / downsample);
  const height = Math.ceil((level.maxY - level.minY + 1) / downsample);
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = 51;
    rgba[index + 1] = 0;
    rgba[index + 2] = 204;
    rgba[index + 3] = 255;
  }

  let seenTiles = 0;
  for (const block of level.blocks) {
    for (let tileY = 0; tileY < blockDimension; tileY += 1) {
      for (let tileX = 0; tileX < blockDimension; tileX += 1) {
        const tileOffset = (tileY * blockDimension + tileX) * tileBytes;
        const color = block.data[tileOffset + 1];
        if (color === 255) continue;
        const pixelX = Math.floor((block.x + tileX - level.minX) / downsample);
        const pixelY = Math.floor((block.y + tileY - level.minY) / downsample);
        const pixelOffset = (pixelY * width + pixelX) * 4;
        const [red, green, blue] = colorFrom8Bit(color);
        rgba[pixelOffset] = red;
        rgba[pixelOffset + 1] = green;
        rgba[pixelOffset + 2] = blue;
        seenTiles += 1;
      }
    }
  }

  const asset = `floor-${z}.png`;
  fs.writeFileSync(path.join(outputDirectory, asset), encodePng(width, height, rgba));
  manifestFloors.push({
    z,
    asset: `/data/map/otmm/${asset}`,
    width,
    height,
    blockCount: level.blocks.length,
    seenTiles,
    bounds: { minX: level.minX, minY: level.minY, maxX: level.maxX, maxY: level.maxY },
  });
}

const manifest = {
  schemaVersion: '0.1.0',
  generatedAt: new Date().toISOString(),
  sourceLocator: 'PokeAllianceV3/minimap854.otmm',
  sourceSizeBytes: sourceBuffer.length,
  sourceModifiedAt: sourceStat.mtime.toISOString(),
  sourceSha256: sourceHash,
  format: { signature: 'OTMM', version, description, blockDimension, tileBytes, downsample },
  recordCount,
  parsedBytes,
  floors: manifestFloors,
  limitations: [
    'La miniatura representa el estado explorado y guardado por un cliente local.',
    'Los colores proceden de la paleta compacta del minimapa; no son una textura oficial completa.',
    'El snapshot no proporciona por sí solo nombres de ciudades, NPCs ni spawns semánticos.',
  ],
};

fs.writeFileSync(stagingPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify(
    { outputDirectory, stagingPath, sourceSha256: sourceHash, recordCount, floors: manifestFloors },
    null,
    2,
  ),
);
