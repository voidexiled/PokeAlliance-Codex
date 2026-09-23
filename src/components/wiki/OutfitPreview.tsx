import { useEffect, useRef, useState } from 'react';

import '@/styles/components/outfit-preview.css';

import { ToggleGroup } from '@/components/controls/ToggleGroup';
import type { ToggleGroupOption } from '@/components/controls/ToggleGroup';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { fill } from '@/i18n/messages/types';
import type { AuraShader } from '@/lib/content/registry-schema';

// OutfitPreview (spec 8.3 step 3, R18, X11, 12.8 D-11 to D-16; DS:ToggleGroup, DS:guias/20):
// the outfit panel of the Pokémon page and its «Aura» group. The page renders it only when
// `getOutfitForPokemon` has the record, and hydrates it with `client:visible`, so the shader
// starts when the panel enters the screen.
//
//   - The panel: 176 wide on `bg-secondary`, radius 12, as tall as the head row it sits in
//     (CGS §6.8), with the idle `sur` frame of the outfit (R18) at an integer scale — a 64
//     frame at 2x fills the 128 box of DS:guias/20, a 32 frame at 4x — and, with an aura
//     chosen, the outline its shader draws around the frame and the ball of the aura, 32 at
//     1x, 12 px from the top right corner (`role="img"`, «Aura Alliance»). There is no
//     direction selector (X11, Q11): the board shows the south frame alone.
//   - «Aura»: `ToggleGroup variant="sprite" direction="column" strong`, its visible label
//     naming the group (D-14): «Ninguna» and one option per aura of `getAuras()` with its
//     ball and its name (D-15). The first aura of the registry is the initial choice.
//
// Two failures, two states (v1 point 18, D-12):
//   - `imageError`: the frame does not load. The panel keeps its size and shows the missing
//     mark of the 64 cell, with no text (7.4.4).
//   - `auraError`: WebGL is not there or the shader does not compile. The frame is drawn
//     without an aura, the aura options are disabled, «Ninguna» is the choice and under the
//     panel a status line says the aura is not available in this browser.
//
// Motion (6.4, FI4): with `prefers-reduced-motion: reduce` the shader draws one frame and
// stops, so the aura is there and still; nothing here is a CSS animation.
//
// Every text arrives by props (DP1); the frame and the balls arrive as `SpriteProps`, which
// the adapter resolved from the registry (DP2).

/** An aura of `content/auras.json` as the panel needs it. */
export interface OutfitAura {
  id: string;
  /** Name of the aura in the game, the same in both locales (13.4). */
  nombre: string;
  /** The client shader the preview reproduces. */
  shader: AuraShader;
  /** `icono` of the aura, its ball of 32, resolved by the adapter; `null` while the key is missing. */
  icon: SpriteProps | null;
}

/** Every text of the panel (DP1). */
export interface OutfitPreviewLabels {
  /** «Outfit»: the name of the panel (D-11). */
  outfit: string;
  /** «Aura»: the visible label that names the group (D-14). */
  aura: string;
  /** «Ninguna» / «None» (D-15). */
  none: string;
  /** «Aura {name}» / «{name} aura»: the name of the ball over the panel. */
  auraBall: string;
  /** «{name}, Sur» / «{name}, South»: the `alt` of the frame (D-13). */
  frame: string;
  /** «El aura no está disponible en este navegador.» / «Aura preview isn't available in this browser.» (D-12). */
  unavailable: string;
}

export interface OutfitPreviewProps {
  /** The idle `sur` frame of the outfit (R18): its URL and its size (`size`, default 32 × 32). */
  frame: SpriteProps;
  /** The auras of the registry, in its order; the first one is the initial choice. */
  auras: readonly OutfitAura[];
  /** Name of the Pokémon, for the `alt` of the frame. */
  name: string;
  labels: OutfitPreviewLabels;
}

/** The value of «Ninguna»: never an aura id, which is a kebab-case slug of the registry. */
const NONE = '';
/** The box the frame fills at an integer scale: a 64 frame at 2x (DS:guias/20). */
const OUTFIT_BOX = 128;
/** Transparent pixels around the frame in the shader's texture, so the outline has room. */
const auraPadding = 1;

const vertexSource = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}`;
// A WebGL adaptation of the client's outfit_alliance and outfit_rainbow
// outline fragments (content/auras.json names the shader of each aura).
const fragmentSource = `
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_texel;
uniform float u_time;
uniform int u_mode;
uniform float u_alpha_threshold;
varying vec2 v_uv;
void main() {
  float threshold = u_alpha_threshold;
  if (texture2D(u_image, v_uv).a > threshold) discard;
  float neighbor = 0.0;
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2(-u_texel.x, 0.0)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2( u_texel.x, 0.0)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2(0.0, -u_texel.y)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2(0.0,  u_texel.y)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2(-u_texel.x, -u_texel.y)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2( u_texel.x, -u_texel.y)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2(-u_texel.x,  u_texel.y)).a);
  neighbor = max(neighbor, texture2D(u_image, v_uv + vec2( u_texel.x,  u_texel.y)).a);
  if (neighbor <= 0.1) discard;
  // The game shader's UV origin is opposite to WebGL's screen-space origin.
  // Adding time here makes the visible gradient travel from top to bottom.
  float hue = fract((v_uv.y + u_time * 0.5) * 3.0);
  vec3 color;
  if (u_mode == 1) {
    vec3 blue = vec3(0.0, 0.5, 1.0);
    vec3 amber = vec3(1.0, 0.8, 0.0);
    vec3 whiteBlue = vec3(0.8, 0.9, 1.0);
    color = hue < 0.33 ? mix(blue, amber, hue / 0.33)
      : hue < 0.66 ? mix(amber, whiteBlue, (hue - 0.33) / 0.33)
      : mix(whiteBlue, blue, (hue - 0.66) / 0.34);
  } else {
    float snappedY = floor(v_uv.y * 256.0 + 0.5) / 256.0;
    float rainbow = fract((snappedY + u_time * 0.5) * 3.0);
    color = vec3(
      0.5 + 0.5 * sin(rainbow * 6.28318),
      0.5 + 0.5 * sin(rainbow * 6.28318 + 2.094),
      0.5 + 0.5 * sin(rainbow * 6.28318 + 4.188)
    );
  }
  gl_FragColor = vec4(color, 0.8);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader unavailable');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(reason || 'WebGL shader compilation failed');
  }
  return shader;
}

function prepareAura(canvas: HTMLCanvasElement, image: HTMLImageElement, padding: number) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL unavailable');
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('WebGL program unavailable');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL linking failed');
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture) throw new Error('WebGL buffer unavailable');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, 1, 0, 1, -1, -1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 0, 0, 1, -1, 1, 0,
    ]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'a_position');
  const uv = gl.getAttribLocation(program, 'a_uv');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
  gl.uniform2f(gl.getUniformLocation(program, 'u_texel'), 1 / canvas.width, 1 / canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, 'u_alpha_threshold'), 0.1);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const padded = document.createElement('canvas');
  padded.width = canvas.width;
  padded.height = canvas.height;
  padded.getContext('2d')?.drawImage(image, padding, padding);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, padded);
  return {
    draw(time: number, shader: AuraShader) {
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time);
      gl.uniform1i(gl.getUniformLocation(program, 'u_mode'), shader === 'outfit_alliance' ? 1 : 2);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

export function OutfitPreview({ frame, auras, name, labels }: OutfitPreviewProps) {
  const [auraId, setAuraId] = useState<string>(auras[0]?.id ?? NONE);
  const [imageError, setImageError] = useState(false);
  const [auraError, setAuraError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Without WebGL no aura is drawn, whatever was chosen before the failure (D-12).
  const aura = auraError ? undefined : auras.find((candidate) => candidate.id === auraId);
  const shader = aura?.shader ?? null;

  // The integer scale that fits the frame in the 128 box (DS:guias/20 §Escala entera).
  const [width, height] = frame.size ?? [32, 32];
  const scale = Math.max(1, Math.floor(OUTFIT_BOX / Math.max(width, height)));

  useEffect(() => {
    let cancelled = false;
    let animationId = 0;
    let renderer: ReturnType<typeof prepareAura> | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A fresh request for the frame: the `<img>` of the prerendered HTML may have failed
    // before the island hydrated, and its `error` event is gone by now.
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setImageError(false);
      if (shader === null || canvasRef.current === null) return;
      try {
        renderer = prepareAura(canvasRef.current, image, auraPadding);
      } catch {
        setAuraError(true);
        return;
      }
      const startedAt = performance.now();
      const draw = (now: number) => {
        if (cancelled || renderer === null) return;
        renderer.draw((now - startedAt) / 1000, shader);
        // Reduced motion: the first frame stays, still (6.4, FI4).
        if (!reducedMotion) animationId = requestAnimationFrame(draw);
      };
      draw(startedAt);
    };
    image.onerror = () => {
      if (!cancelled) setImageError(true);
    };
    image.src = frame.src;
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      image.onload = null;
      image.onerror = null;
      renderer?.dispose();
    };
  }, [frame.src, shader]);

  const options: ToggleGroupOption[] = [
    { value: NONE, label: labels.none },
    ...auras.map((candidate) => ({
      value: candidate.id,
      label: candidate.nombre,
      sprite: candidate.icon ?? undefined,
      disabled: auraError,
    })),
  ];

  // The outline travels one native pixel around the frame, drawn at the frame's scale.
  const canvasWidth = width + auraPadding * 2;
  const canvasHeight = height + auraPadding * 2;

  return (
    <div className="ac-outfit-preview" data-testid="outfit-preview">
      <div className="ac-outfit-preview__main">
        <div className="ac-outfit-preview__panel" role="group" aria-label={labels.outfit}>
          {imageError ? (
            // The frame did not load: the missing mark of the 64 cell, and no text (8.3).
            <SpriteStage sprite={null} size={64} framed={false} />
          ) : (
            <span className="ac-outfit-preview__stage">
              <Sprite {...frame} scale={scale} alt={fill(labels.frame, { name })} />
              {shader === null ? null : (
                <canvas
                  ref={canvasRef}
                  className="ac-outfit-preview__aura"
                  width={canvasWidth}
                  height={canvasHeight}
                  aria-hidden="true"
                  // Geometry of the sprite (C-R2): the texture's padding, at the frame's scale.
                  style={{
                    left: -auraPadding * scale,
                    top: -auraPadding * scale,
                    width: canvasWidth * scale,
                    height: canvasHeight * scale,
                  }}
                />
              )}
            </span>
          )}
          {aura?.icon ? (
            <span
              className="ac-outfit-preview__ball"
              role="img"
              aria-label={fill(labels.auraBall, { name: aura.nombre })}
            >
              <Sprite {...aura.icon} />
            </span>
          ) : null}
        </div>
        {auraError ? (
          <p className="ac-outfit-preview__note" role="status">
            {labels.unavailable}
          </p>
        ) : null}
      </div>
      {auras.length > 0 ? (
        <ToggleGroup
          variant="sprite"
          direction="column"
          strong
          labelHidden={false}
          label={labels.aura}
          options={options}
          value={aura?.id ?? NONE}
          onChange={(value) => setAuraId(value)}
        />
      ) : null}
    </div>
  );
}
