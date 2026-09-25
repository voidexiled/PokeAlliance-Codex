import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Sprite } from '@/components/game/Sprite';
import { spriteRegistry } from '@/lib/sprites/registry';
import {
  FIXED_SPRITE_KEYS,
  SpriteError,
  assertRegisteredAnimation,
  animationCss,
  animationName,
  animationSignature,
  animationTimeline,
  cellPlacement,
  frameAt,
  frameForQuantity,
  frameObjectPosition,
  isIllustration,
  registryAnimationCss,
  resolveFrame,
  resolveSprite,
  spriteData,
  spriteMode,
  spriteOrNull,
  type SpriteRegistry,
} from '@/lib/sprites/resolve';

const registry: SpriteRegistry = {
  'ui/diamond': {
    archivo: 'ui/diamond.png',
    frame: [32, 32],
    frames: 7,
    modo: 'animacion',
    duracionMs: [110, 110, 110, 110, 110, 110, 110],
  },
  // Same signature as ui/diamond: seven frames of 110 ms that loop. Both share one
  // @keyframes block (spec 7.4.2).
  'ui/comercio/diamond': {
    archivo: 'ui/comercio/diamond.png',
    frame: [32, 32],
    frames: 7,
    modo: 'animacion',
    duracionMs: [110, 110, 110, 110, 110, 110, 110],
  },
  'items/poke-balls/alliance-ball': {
    archivo: 'items/poke-balls/alliance-ball.png',
    frame: [32, 32],
    frames: 8,
    modo: 'cantidad',
    umbrales: [1, 2, 3, 4, 5, 10, 25, 100],
  },
  'items/poke-balls/ultra-ball': {
    archivo: 'items/poke-balls/ultra-ball.png',
    frame: [32, 32],
    frames: 5,
    modo: 'variante',
  },
  'ui/balls/ultra-ball': {
    archivo: 'ui/balls/ultra-ball.png',
    frame: [32, 32],
    frames: 1,
    modo: 'estatico',
  },
  'ui/intro': {
    archivo: 'ui/intro.png',
    frame: [16, 24],
    frames: 3,
    modo: 'animacion',
    duracionMs: [100, 300, 50],
    loop: false,
  },
  'outfits/7': {
    archivo: 'outfits/7/sur.png',
    frame: [64, 64],
    frames: 1,
    modo: 'estatico',
    direcciones: {
      norte: 'outfits/7/norte.png',
      este: 'outfits/7/este.png',
      sur: 'outfits/7/sur.png',
      oeste: 'outfits/7/oeste.png',
    },
  },
  // An element icon: 100 px of source, an illustration and not a pixel sprite.
  'elementos/fuego': {
    archivo: 'elementos/fuego.png',
    frame: [100, 100],
    frames: 1,
    modo: 'estatico',
  },
};
const alliance = registry['items/poke-balls/alliance-ball'];
const ultra = registry['items/poke-balls/ultra-ball'];
const diamond = registry['ui/diamond'];
const intro = registry['ui/intro'];

const DIAMOND_ANIM = 'ac-sprite-7-110-110-110-110-110-110-110';
const INTRO_ANIM = 'ac-sprite-3-100-300-50-once';

describe('frame selection', () => {
  it('maps quantities to the last threshold reached', () => {
    const thresholds = alliance.umbrales ?? [];
    expect(
      [0, 1, 2, 5, 6, 9, 10, 24, 25, 99, 100, 5000].map((n) => frameForQuantity(thresholds, n)),
    ).toEqual([0, 0, 1, 4, 4, 4, 5, 5, 6, 6, 7, 7]);
    expect(() => frameForQuantity(thresholds, -1)).toThrow(SpriteError);
    expect(() => frameForQuantity(thresholds, 1.5)).toThrow(/entero/);
  });

  it('resolves variant, static and quantity frames with bounds checks', () => {
    expect(resolveFrame('items/poke-balls/ultra-ball', ultra, { frame: 4 })).toBe(4);
    expect(resolveFrame('items/poke-balls/ultra-ball', ultra)).toBe(0);
    expect(() => resolveFrame('items/poke-balls/ultra-ball', ultra, { frame: 5 })).toThrow(
      /fuera de rango/,
    );
    expect(() => resolveFrame('items/poke-balls/ultra-ball', ultra, { frame: -1 })).toThrow(
      SpriteError,
    );
    expect(() =>
      resolveFrame('ui/balls/ultra-ball', registry['ui/balls/ultra-ball'], { frame: 1 }),
    ).toThrow(/1 frame/);
    expect(resolveFrame('items/poke-balls/alliance-ball', alliance, { cantidad: 25 })).toBe(6);
    expect(() => resolveFrame('items/poke-balls/ultra-ball', ultra, { cantidad: 3 })).toThrow(
      /no es un sprite de cantidad/,
    );
  });

  it('places each frame of a horizontal strip with a scale-free object-position', () => {
    expect(frameObjectPosition(1, 0)).toBe('0% 0%');
    expect(frameObjectPosition(7, 0)).toBe('0% 0%');
    expect(frameObjectPosition(7, 3)).toBe('50% 0%');
    expect(frameObjectPosition(7, 6)).toBe('100% 0%');
    expect(frameObjectPosition(8, 1)).toBe('14.2857% 0%');
  });

  it('infers the mode of a sheet from its data', () => {
    expect(spriteMode(1)).toBe('estatico');
    expect(spriteMode(7, { durations: diamond.duracionMs })).toBe('animacion');
    expect(spriteMode(8, { thresholds: alliance.umbrales })).toBe('cantidad');
    expect(spriteMode(5)).toBe('variante');
  });
});

describe('game cell and illustrations', () => {
  it('centres a sprite on whole pixels inside its cell', () => {
    // Spec 7.4.3: a sprite of 15 x 15 at 2x sits at 16, 16 of a 64 px cell.
    expect(cellPlacement([15, 15], 2)).toEqual({ size: 64, left: 16, top: 16 });
    expect(cellPlacement([32, 32], 1)).toEqual({ size: 32, left: 0, top: 0 });
    expect(cellPlacement([32, 32], 2)).toEqual({ size: 64, left: 0, top: 0 });
    expect(cellPlacement([16, 24], 3)).toEqual({ size: 96, left: 24, top: 12 });
    // Larger than 32 on either side: the cell is 64.
    expect(cellPlacement([64, 64], 1)).toEqual({ size: 64, left: 0, top: 0 });
    expect(cellPlacement([33, 16], 1)).toEqual({ size: 64, left: 15, top: 24 });
  });

  it('calls a frame larger than the 64 px cell an illustration', () => {
    expect(
      [
        [32, 32],
        [64, 64],
        [16, 24],
      ].map((frame) => isIllustration(frame as [number, number])),
    ).toEqual([false, false, false]);
    expect(
      [
        [100, 100],
        [140, 140],
        [64, 100],
      ].map((frame) => isIllustration(frame as [number, number])),
    ).toEqual([true, true, true]);
  });
});

describe('animation timeline', () => {
  it('builds the schedule from per-frame durations', () => {
    expect(animationTimeline('ui/intro', intro)).toEqual({
      totalMs: 450,
      steps: [
        { frame: 0, startMs: 0, durationMs: 100 },
        { frame: 1, startMs: 100, durationMs: 300 },
        { frame: 2, startMs: 400, durationMs: 50 },
      ],
    });
    expect(() => animationTimeline('items/poke-balls/ultra-ball', ultra)).toThrow(
      /no es una animación/,
    );
    expect(() => animationTimeline('ui/diamond', { ...diamond, duracionMs: [110, 110] })).toThrow(
      /2 valores y la hoja 7 frames/,
    );
    expect(() => animationTimeline('ui/intro', { ...intro, duracionMs: [100, 0, 50] })).toThrow(
      /duración inválida en el frame 1/,
    );
  });

  it('finds the frame at a given time, looping or holding the last frame', () => {
    expect([0, 109, 110, 769, 770, 880].map((ms) => frameAt('ui/diamond', diamond, ms))).toEqual([
      0, 0, 1, 6, 0, 1,
    ]);
    expect(
      [0, 99, 100, 399, 400, 449, 450, 10_000].map((ms) => frameAt('ui/intro', intro, ms)),
    ).toEqual([0, 0, 1, 1, 2, 2, 2, 2]);
  });

  it('names the keyframes after the signature and not after the key (spec 7.4.2)', () => {
    expect(animationSignature('ui/diamond', diamond)).toEqual({
      frames: 7,
      durations: [110, 110, 110, 110, 110, 110, 110],
      loop: true,
    });
    expect(animationSignature('ui/intro', intro)).toEqual({
      frames: 3,
      durations: [100, 300, 50],
      loop: false,
    });
    expect(animationName(animationSignature('ui/diamond', diamond))).toBe(DIAMOND_ANIM);
    expect(animationName(animationSignature('ui/intro', intro))).toBe(INTRO_ANIM);
    // Two keys that move the same way share the name, and so the block.
    expect(
      animationName(animationSignature('ui/comercio/diamond', registry['ui/comercio/diamond'])),
    ).toBe(DIAMOND_ANIM);
    // `-once` is the whole difference between a sheet that loops and one that does not.
    expect(animationName({ frames: 3, durations: [100, 300, 50], loop: true })).toBe(
      'ac-sprite-3-100-300-50',
    );
    for (const bad of [
      { frames: 0, durations: [], loop: true },
      { frames: 3, durations: [100, 300], loop: true },
      { frames: 2, durations: [100, 0], loop: true },
      { frames: 2, durations: [100, 1.5], loop: true },
    ]) {
      expect(() => animationName(bad), JSON.stringify(bad)).toThrow(SpriteError);
    }
  });

  it('emits stepped keyframes that only run without reduced motion', () => {
    const css = animationCss(animationSignature('ui/intro', intro));
    expect(css).toContain(
      `@keyframes ${INTRO_ANIM}{0%{object-position:0% 0%}22.2222%{object-position:50% 0%}88.8889%{object-position:100% 0%}100%{object-position:100% 0%}}`,
    );
    expect(css).toContain('@media (prefers-reduced-motion:no-preference)');
    expect(css).toContain(`.ac-sprite[data-anim='${INTRO_ANIM}']`);
    expect(css).toContain(`animation:${INTRO_ANIM} 450ms steps(1,end) 1 forwards`);
    expect(animationCss(animationSignature('ui/diamond', diamond))).toContain(
      '770ms steps(1,end) infinite',
    );
  });

  it('writes one block per distinct signature of the registry', () => {
    const all = registryAnimationCss(registry);
    expect(all.match(/@keyframes /g)).toHaveLength(2);
    expect(all).toContain(`@keyframes ${DIAMOND_ANIM}{`);
    expect(all).toContain(`@keyframes ${INTRO_ANIM}{`);
    expect(all).not.toContain('alliance-ball');
    expect(registryAnimationCss({ 'ui/balls/ultra-ball': registry['ui/balls/ultra-ball'] })).toBe(
      '',
    );
  });

  it('fails an animation whose signature the registry does not declare (spec 7.4.2)', () => {
    expect(() => assertRegisteredAnimation(registry, DIAMOND_ANIM)).not.toThrow();
    expect(() => assertRegisteredAnimation(registry, INTRO_ANIM)).not.toThrow();
    // Same frames as the Diamond, other durations: no `@keyframes` would exist for it.
    const handWritten = animationName({
      frames: 7,
      durations: [100, 100, 100, 100, 100, 100, 100],
      loop: true,
    });
    expect(() => assertRegisteredAnimation(registry, handWritten)).toThrow(SpriteError);
    // The loop is part of the signature: the Diamond played once is not the Diamond.
    expect(() => assertRegisteredAnimation(registry, `${DIAMOND_ANIM}-once`)).toThrow(SpriteError);
  });

  it('lets Sprite render only the animations of the registry (spec 7.4.2)', () => {
    // A real animation of the registry: the Boost stone (the Diamond is the still gem now).
    const boost = spriteRegistry['ui/sistemas/boost'];
    expect(boost?.modo, 'the real registry animates the Boost stone').toBe('animacion');
    const html = renderToStaticMarkup(
      createElement(Sprite, {
        src: '/sprites/ui/sistemas/boost.png',
        frames: boost?.frames,
        durations: boost?.duracionMs,
      }),
    );
    expect(html).toContain(
      `data-anim="${animationName({ frames: boost?.frames ?? 0, durations: boost?.duracionMs ?? [], loop: true })}"`,
    );
    expect(() =>
      renderToStaticMarkup(
        createElement(Sprite, {
          src: '/sprites/ui/sistemas/boost.png',
          frames: 2,
          durations: [50, 70],
        }),
      ),
    ).toThrow(SpriteError);
  });
});

describe('spriteData', () => {
  it('translates a key and its options into the props of Sprite', () => {
    expect(spriteData(registry, 'ui/balls/ultra-ball')).toEqual({
      src: '/sprites/ui/balls/ultra-ball.png',
      size: [32, 32],
      frames: 1,
      mode: 'estatico',
    });
    expect(spriteData(registry, 'items/poke-balls/ultra-ball', { frame: 4, escala: 2 })).toEqual({
      src: '/sprites/items/poke-balls/ultra-ball.png',
      size: [32, 32],
      frames: 5,
      mode: 'variante',
      frame: 4,
      scale: 2,
    });
  });

  it('hands a quantity sheet its thresholds so the stack can change per render', () => {
    expect(spriteData(registry, 'items/poke-balls/alliance-ball', { cantidad: 25 })).toEqual({
      src: '/sprites/items/poke-balls/alliance-ball.png',
      size: [32, 32],
      frames: 8,
      mode: 'cantidad',
      thresholds: [1, 2, 3, 4, 5, 10, 25, 100],
      quantity: 25,
    });
    expect(spriteData(registry, 'items/poke-balls/alliance-ball').quantity).toBeUndefined();
  });

  it('sends the durations only when the animation was asked for', () => {
    expect(spriteData(registry, 'ui/diamond', { animado: true, escala: 2 })).toEqual({
      src: '/sprites/ui/diamond.png',
      size: [32, 32],
      frames: 7,
      mode: 'animacion',
      durations: [110, 110, 110, 110, 110, 110, 110],
      scale: 2,
    });
    // Still on frame 0 in front of an amount and in the menu (spec 6.3).
    expect(spriteData(registry, 'ui/diamond').durations).toBeUndefined();
    expect(spriteData(registry, 'ui/intro', { animado: true })).toMatchObject({
      durations: [100, 300, 50],
      loop: false,
    });
  });

  it('marks an illustration and picks an outfit direction', () => {
    expect(spriteData(registry, 'elementos/fuego')).toMatchObject({
      size: [100, 100],
      smooth: true,
    });
    expect(spriteData(registry, 'outfits/7').smooth).toBeUndefined();
    expect(spriteData(registry, 'outfits/7', { direccion: 'norte' }).src).toBe(
      '/sprites/outfits/7/norte.png',
    );
  });

  it('fails the build on an unknown key, a bad scale or an impossible option', () => {
    expect(() => spriteData(registry, 'ui/missing')).toThrow(/no existe/);
    expect(() => spriteData(registry, 'ui/diamond', { escala: 1.5 })).toThrow(/Escala/);
    expect(() => spriteData(registry, 'ui/diamond', { escala: 17 })).toThrow(/Escala/);
    expect(() => spriteData(registry, 'items/poke-balls/ultra-ball', { frame: 9 })).toThrow(
      /fuera de rango/,
    );
    expect(() => spriteData(registry, 'ui/balls/ultra-ball', { animado: true })).toThrow(
      /no es una animación/,
    );
    expect(() => spriteData(registry, 'ui/diamond', { direccion: 'sur' })).toThrow(
      /no tiene direcciones/,
    );
  });
});

describe('spriteOrNull', () => {
  it('answers null for a registry field with no key yet', () => {
    expect(spriteOrNull(registry, null)).toBeNull();
    expect(spriteOrNull(registry, undefined)).toBeNull();
  });

  it('answers null for a fixed key the owner has not registered yet', () => {
    for (const key of ['ui/inicio', 'ui/indice/pokedex', 'ui/herramientas/mapa', 'ui/cambios']) {
      expect(FIXED_SPRITE_KEYS, key).toContain(key);
      expect(spriteOrNull(registry, key), key).toBeNull();
    }
  });

  it('still fails the build for any other missing key', () => {
    expect(() => spriteOrNull(registry, 'items/stones/water-stone')).toThrow(/no existe/);
    expect(() => spriteOrNull(registry, 'ui/balls/master-ball')).toThrow(SpriteError);
  });

  it('resolves a key that is in the registry, options included', () => {
    expect(spriteOrNull(registry, 'ui/diamond', { animado: true })).toMatchObject({
      src: '/sprites/ui/diamond.png',
      mode: 'animacion',
    });
  });
});

describe('resolveSprite', () => {
  it('returns the image, box size and visible frame', () => {
    expect(
      resolveSprite(registry, 'items/poke-balls/alliance-ball', { cantidad: 100, escala: 2 }),
    ).toEqual({
      key: 'items/poke-balls/alliance-ball',
      src: '/sprites/items/poke-balls/alliance-ball.png',
      frame: 7,
      width: 64,
      height: 64,
      objectPosition: '100% 0%',
      aspectRatio: '32 / 32',
      animation: null,
    });
  });

  it('starts animations on frame 0 and names their keyframes', () => {
    const sprite = resolveSprite(registry, 'ui/diamond', { animado: true, escala: 3 });
    expect(sprite).toMatchObject({ frame: 0, width: 96, animation: DIAMOND_ANIM });
    expect(sprite.objectPosition).toBe('0% 0%');
    expect(() => resolveSprite(registry, 'ui/balls/ultra-ball', { animado: true })).toThrow(
      /no es una animación/,
    );
  });

  it('picks an outfit direction image', () => {
    expect(resolveSprite(registry, 'outfits/7', { direccion: 'norte' }).src).toBe(
      '/sprites/outfits/7/norte.png',
    );
    expect(resolveSprite(registry, 'outfits/7').src).toBe('/sprites/outfits/7/sur.png');
    expect(() => resolveSprite(registry, 'ui/diamond', { direccion: 'sur' })).toThrow(
      /no tiene direcciones/,
    );
  });

  it('rejects unknown keys and non-integer scales', () => {
    expect(() => resolveSprite(registry, 'ui/missing')).toThrow(/no existe/);
    expect(() => resolveSprite(registry, 'ui/diamond', { escala: 1.5 })).toThrow(/Escala/);
    expect(() => resolveSprite(registry, 'ui/diamond', { escala: 0 })).toThrow(/Escala/);
  });
});
