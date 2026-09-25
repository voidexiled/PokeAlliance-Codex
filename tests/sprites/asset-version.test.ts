import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';

import { folderVersion } from '../../scripts/lib/asset-versions.mjs';

import { PokemonArt } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import { POKEMON_ART_VERSION, SPRITES_VERSION, assetSrc, versioned } from '@/lib/assets/version';
import { expandListSprite } from '@/lib/sprites/resolve';

// Spec 7.4.1: a sprite that changes under the same name (ui/diamond, a 7-frame coin that became
// a 22-frame gem) must be a new URL, or a cached copy is drawn with the frames of the new one.

const root = mkdtempSync(path.join(tmpdir(), 'ac-asset-version-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('asset versions', () => {
  it('are 8 hex digits of the content of public/sprites/ and public/pokemon/', () => {
    expect(SPRITES_VERSION).toMatch(/^[0-9a-f]{8}$/);
    expect(POKEMON_ART_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });

  it('go on the URL an image loads, once, and on no other URL', () => {
    const sprite = `/sprites/ui/diamond.png?v=${SPRITES_VERSION}`;
    expect(assetSrc('/sprites/ui/diamond.png')).toBe(sprite);
    expect(assetSrc(sprite)).toBe(sprite);
    expect(assetSrc('/pokemon/140/006.webp')).toBe(
      `/pokemon/140/006.webp?v=${POKEMON_ART_VERSION}`,
    );
    expect(assetSrc('https://cdn.example/avatar.png')).toBe('https://cdn.example/avatar.png');
    expect(versioned('/es/items/datos.json')).toBe(`/es/items/datos.json?v=${SPRITES_VERSION}`);
  });

  it('reach the <img> of Sprite and PokemonArt, while the data keeps the bare path', () => {
    const gem = expandListSprite('3028x22');
    expect(gem?.src).toBe('/sprites/items/cliente/3028.png');
    const html = renderToStaticMarkup(createElement(Sprite, gem ?? { src: '', size: [32, 32] }));
    expect(html).toContain(`src="/sprites/items/cliente/3028.png?v=${SPRITES_VERSION}"`);
    const art = renderToStaticMarkup(
      createElement(PokemonArt, { src: '/pokemon/128/006.webp', size: 64 }),
    );
    expect(art).toContain(`src="/pokemon/128/006.webp?v=${POKEMON_ART_VERSION}"`);
  });

  it('change when a file changes under the same name, and only then', () => {
    const dir = path.join(root, 'sprites');
    mkdirSync(path.join(dir, 'ui'), { recursive: true });
    writeFileSync(path.join(dir, 'ui', 'diamond.png'), 'coin, 7 frames');
    const before = folderVersion(dir);
    expect(folderVersion(dir)).toBe(before);
    writeFileSync(path.join(dir, 'ui', 'diamond.png'), 'gem, 22 frames');
    expect(folderVersion(dir)).not.toBe(before);
    expect(folderVersion(path.join(root, 'missing'))).toBe('');
  });
});
