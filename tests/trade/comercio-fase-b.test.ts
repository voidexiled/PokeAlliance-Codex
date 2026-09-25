import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AGE_ANSWER_KEY,
  ageGateAction,
  readAgeAnswer,
  writeAgeAnswer,
} from '@/components/trade/AgeGate';
import { contactBlocker } from '@/components/trade/RealMoneyConsent';
import { DATOS_PATTERN, MODERACION_PATTERN, comercioFases } from '@/integrations/comercio-fases';
import { inGameFirst, sellerReputation } from '@/lib/trade/types';
import type { EstadoPresencia } from '@/lib/trade/types';

// Comercio phase B inside the pages of M12 (spec 9.3, 9.15.2, 9.15.4, 9.15.6): the reputation
// that counts each counterpart once, the list order with the sellers «En el juego» first, the
// pure part of the 18+ gate and the routes the phase injects.

/** A storage over a map; `broken` makes every access throw, as a blocked one does. */
function memoryStorage(initial: Record<string, string> = {}, broken = false): Storage {
  const values = new Map(Object.entries(initial));
  const guard = () => {
    if (broken) throw new DOMException('blocked', 'SecurityError');
  };
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => {
      guard();
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      guard();
      values.set(key, value);
    },
    removeItem: (key: string) => {
      guard();
      values.delete(key);
    },
  };
}

describe('the reputation of 9.15.4 (`sellerReputation`)', () => {
  const reviews = (comprador: string, ...scores: number[]) =>
    scores.map((puntuacion) => ({ puntuacion, comprador }));

  it('counts each counterpart once: 40 reviews of 5 and one of 1 are 3.0 (CA-9.15.9 #6)', () => {
    const reputation = sellerReputation([
      ...reviews('alfa', ...Array<number>(40).fill(5)),
      ...reviews('beta', 1),
    ]);
    expect(reputation.valoracion).toBe(3);
    expect(reputation.resenas).toBe(41);
    expect(reputation.operaciones).toBe(41);
    expect(reputation.contrapartes).toBe(2);
    expect(reputation.distribucion).toEqual([0, 1, 0, 0, 0, 40]);
  });

  it('rounds the mean of the means half up to one decimal, exactly', () => {
    // Buyer means 4, 4.5 and 13/3: their mean, 4.2777…, is 4.3.
    expect(
      sellerReputation([...reviews('a', 4), ...reviews('b', 4, 5), ...reviews('c', 4, 4, 5)])
        .valoracion,
    ).toBe(4.3);
    // Buyer means 21/5 and 9/2: their mean is 4.35 exactly, so 4.4 and never 4.3 through a
    // binary fraction ((4.2 + 4.5) / 2 * 10 is 43.49999… in floating point).
    expect(
      sellerReputation([...reviews('a', 4, 4, 4, 4, 5), ...reviews('b', 4, 5)]).valoracion,
    ).toBe(4.4);
  });

  it('gives no score without reviews, and skips a score outside 0 to 5', () => {
    expect(sellerReputation([])).toEqual({
      valoracion: null,
      resenas: 0,
      distribucion: [0, 0, 0, 0, 0, 0],
      operaciones: 0,
      contrapartes: 0,
    });
    const odd = sellerReputation([...reviews('a', 6, -1, 2.5), ...reviews('b', 5)]);
    expect(odd.valoracion).toBe(5);
    expect(odd.contrapartes).toBe(1);
  });
});

describe('the list order of 9.15.6 (`inGameFirst`)', () => {
  it('puts the sellers «En el juego» first and keeps the other order inside each part', () => {
    const presence: Record<string, EstadoPresencia | null> = {
      a: 'ausente',
      b: 'en_juego',
      c: null,
      d: 'desconectado',
      e: 'en_juego',
    };
    const rows = ['a', 'b', 'c', 'd', 'e'];
    const byName = (x: string, y: string) => x.localeCompare(y);
    expect([...rows].reverse().sort(inGameFirst((row) => presence[row], byName))).toEqual([
      'b',
      'e',
      'a',
      'c',
      'd',
    ]);
    // With a neutral comparator the sort is stable: the incoming order stays within each part.
    expect(
      ['d', 'e', 'a', 'b'].sort(
        inGameFirst(
          (row) => presence[row],
          () => 0,
        ),
      ),
    ).toEqual(['e', 'b', 'd', 'a']);
  });
});

describe('the 18+ gate of 9.15.2 (AgeGate)', () => {
  it('reads and writes the remembered answer, and survives a blocked storage', () => {
    const storage = memoryStorage();
    expect(readAgeAnswer(storage)).toBeNull();
    writeAgeAnswer(storage, 'adulto');
    expect(storage.getItem(AGE_ANSWER_KEY)).toBe('adulto');
    expect(readAgeAnswer(storage)).toBe('adulto');
    writeAgeAnswer(storage, 'menor');
    expect(readAgeAnswer(storage)).toBe('menor');
    expect(readAgeAnswer(memoryStorage({ [AGE_ANSWER_KEY]: 'yes' }))).toBeNull();

    const blocked = memoryStorage({}, true);
    expect(() => writeAgeAnswer(blocked, 'adulto')).not.toThrow();
    expect(readAgeAnswer(blocked)).toBeNull();
    expect(readAgeAnswer(null)).toBeNull();
  });

  it('decides by the account when its age is known, else by the answer, else asks', () => {
    expect(ageGateAction(true, 'menor')).toBe('pass');
    expect(ageGateAction(false, 'adulto')).toBe('home');
    expect(ageGateAction(null, 'adulto')).toBe('pass');
    expect(ageGateAction(null, 'menor')).toBe('home');
    expect(ageGateAction(null, null)).toBe('ask');
  });
});

describe('what stops a contact (9.15.2, `contactBlocker`)', () => {
  const labels = {
    account: 'account',
    adultsOnly: 'adults',
    discord: 'discord',
    discordAge: 'discord-age',
    suspendedUntil: 'until {date}',
    suspended: 'suspended',
    goToAccount: 'go',
  };
  const block = (
    comercioBlock: Parameters<typeof contactBlocker>[0]['comercioBlock'],
    suspendedUntil: string | null = null,
    comercioEligible = comercioBlock === null,
  ) => contactBlocker({ comercioBlock, comercioEligible, suspendedUntil }, 'es', labels);
  const toAccount = { href: '/es/cuenta/', label: 'go' };

  it('lets an eligible account through', () => {
    expect(block(null)).toBeNull();
  });

  it('names the requirement the database says is missing', () => {
    expect(block('account_incomplete')).toEqual({ text: 'account', link: toAccount });
    expect(block('underage')).toEqual({ text: 'adults', link: null });
    expect(block('discord_missing')).toEqual({ text: 'discord', link: toAccount });
    expect(block('discord_too_new')).toEqual({ text: 'discord-age', link: null });
    expect(block('suspended', 'infinity')).toEqual({ text: 'suspended', link: null });
    expect(block('suspended', '2026-10-01T12:00:00Z')).toEqual({
      text: 'until 01/10/2026',
      link: null,
    });
    // A refusal without a named reason still sends the account to complete itself.
    expect(block(null, null, false)).toEqual({ text: 'account', link: toAccount });
  });
});

describe('the routes of each phase (src/integrations/comercio-fases.ts, 9.3)', () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  /** The patterns and prerender flags the integration injects with these switches. */
  function injected(demo: string, publico: string) {
    vi.stubEnv('COMERCIO_DEMO', demo);
    vi.stubEnv('COMERCIO_PUBLICO', publico);
    // A root without .env files: only the environment of the process decides.
    const root = mkdtempSync(join(tmpdir(), 'comercio-fases-'));
    roots.push(root);
    const routes: { pattern: string; prerender?: boolean; entrypoint: string }[] = [];
    const setup = comercioFases().hooks['astro:config:setup'] as unknown as (options: {
      config: { root: URL; srcDir: URL; vite: Record<string, unknown> };
      command: string;
      injectRoute: (route: { pattern: string; prerender?: boolean; entrypoint: URL }) => void;
    }) => void;
    setup({
      config: {
        root: pathToFileURL(`${root}/`),
        srcDir: pathToFileURL(`${join(root, 'src')}/`),
        vite: {},
      },
      command: 'build',
      injectRoute: ({ pattern, prerender, entrypoint }) =>
        routes.push({ pattern, prerender, entrypoint: entrypoint.pathname.split('/src/')[1] }),
    });
    return routes;
  }

  // «Mis operaciones» is a page of the account (`/{l}/cuenta/operaciones/`), not an injection.
  it('injects the moderation on demand, only in phase B', () => {
    expect(injected('', '1')).toEqual([
      {
        pattern: MODERACION_PATTERN,
        prerender: false,
        entrypoint: 'routes/comercio/moderacion.astro',
      },
    ]);
    expect(injected('1', 'true').map((route) => route.pattern)).toEqual([MODERACION_PATTERN]);
  });

  it('injects nothing of phase B without COMERCIO_PUBLICO (S11, CA-9.13)', () => {
    expect(injected('', '')).toEqual([]);
    expect(injected('1', '0')).toEqual([
      { pattern: DATOS_PATTERN, prerender: true, entrypoint: 'routes/comercio/datos.json.ts' },
    ]);
  });
});
