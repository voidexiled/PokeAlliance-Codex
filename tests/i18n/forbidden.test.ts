import { describe, expect, it } from 'vitest';

import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import type { MessageLeaf, MessageTree } from '@/i18n/messages/types';
import { isPluralMessage, messageAt, messageKeys } from '@/i18n/messages/types';

// The forbidden list of spec §12.22, transcribed. tests/e2e/content-sentinel
// applies the same list to the visible text of every route; this test applies
// the part that can be read from the dictionaries.
//
// Comparison rules of §12.22: plain strings match as a case-insensitive
// substring unless marked otherwise, patterns match with their own flags, and
// the entries marked (=) match only when they are the whole value, because they
// are words that can appear inside a game name.

const BOTH_SUBSTRINGS = [
  'Wiki Core',
  'Supabase',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'flagId',
  'OTMM',
  'Minimap.flags',
  'availability_scope',
  'training_charger',
  'pending_review',
  'exportedAt',
  'manual-paste',
  'Family One',
  'Membro',
  'Vice-Líder',
  'roster',
  'snapshot OTMM',
  'Provenance',
  'Procedencia',
  'Fuente:',
  'Fuentes',
  'Source:',
  'Sources',
  'Verificado el',
  'Verified on',
  'Dato confirmado',
  'Según la hoja',
  'evidencia',
  'evidence',
  'Próximamente',
  'Coming soon',
  'hoja de ruta',
  'roadmap',
  'Preview disponible',
  'Disponible en local',
  'Borrador local',
  'Local draft',
  'Ctrl K',
  'Lorem',
  'undefined',
  'NaN',
  '[object Object]',
  'Invalid Date',
];

/** «Temporal» is forbidden with that capital: it is the JS API, not the word. */
const BOTH_CASE_SENSITIVE = ['Temporal'];

const BOTH_PATTERNS = [
  /\bKKs?\b/,
  /\bgold\b/,
  /\bTODO\b/,
  /\bT(Legendary|Mythic|ULTIMATE|Super Rare|Ultra Rare)\b/,
  /[↗✦]/u,
  /\b\d+\s?px\b/,
];

/** Only in the dictionaries: the site writes no emoji and no exclamation. */
const DICTIONARY_ONLY_PATTERNS = [/\p{Extended_Pictographic}/u, /!/];

const ES_ONLY_SUBSTRINGS = [
  'Datos de la ficha',
  'Archivo de campo',
  'registros normalizados',
  'Delta calculado',
  'Training skills',
  'Cambiar a English',
  'Outfit del juego',
  'Precio NPC: aún no',
  'Objetos de sistema',
  // Interface text in English outside [lang="en"].
  'Hold Shift to pin',
  'Search...',
  'Open menu',
  'Skip to content',
];

const ES_ONLY_WHOLE_VALUES = ['Breadcrumb', 'Close'];

const EN_ONLY_SUBSTRINGS = [
  'Record data',
  'Local draft',
  'Field archive',
  'Game outfit',
  'normalized records',
  'Client map',
  'Switch to Español',
  // Spanish defaults of the design system, which the composer must override.
  'Mantén Shift para fijar',
  'Buscar...',
  'Cambiar a tema claro',
  'Abrir menú',
  'Cerrar menú',
  'Saltar al contenido',
  'Migas de pan',
  'Idioma:',
  'Cerrar aviso',
  'es un proyecto comunitario',
];

const EN_ONLY_WHOLE_VALUES = ['Paginación', 'Vista', 'Lista', 'Resumen'];

/** §9.9: the Spanish copy of Comercio and cuenta promises none of these. */
const TRADE_ES_WORDS = ['confiable', 'seguro', 'garantizado'];

function wordPattern(word: string): RegExp {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu');
}

/** Every reason `value` breaks §12.22, as the ids a reader can look up. */
function forbiddenReasons(value: string, locale: 'es' | 'en', namespace: string): string[] {
  const reasons: string[] = [];
  const lower = value.toLowerCase();
  for (const needle of BOTH_SUBSTRINGS) {
    if (lower.includes(needle.toLowerCase())) reasons.push(`ambos: «${needle}»`);
  }
  for (const needle of BOTH_CASE_SENSITIVE) {
    if (value.includes(needle)) reasons.push(`ambos (mayúsculas exactas): «${needle}»`);
  }
  for (const pattern of BOTH_PATTERNS) {
    if (pattern.test(value)) reasons.push(`ambos: ${pattern}`);
  }
  for (const pattern of DICTIONARY_ONLY_PATTERNS) {
    if (pattern.test(value)) reasons.push(`diccionarios: ${pattern}`);
  }
  const substrings = locale === 'es' ? ES_ONLY_SUBSTRINGS : EN_ONLY_SUBSTRINGS;
  for (const needle of substrings) {
    if (lower.includes(needle.toLowerCase())) reasons.push(`solo ${locale}: «${needle}»`);
  }
  const wholeValues = locale === 'es' ? ES_ONLY_WHOLE_VALUES : EN_ONLY_WHOLE_VALUES;
  for (const needle of wholeValues) {
    if (value.trim().toLowerCase() === needle.toLowerCase()) {
      reasons.push(`solo ${locale} (valor completo): «${needle}»`);
    }
  }
  if (locale === 'es' && namespace === 'trade') {
    for (const word of TRADE_ES_WORDS) {
      if (wordPattern(word).test(value)) reasons.push(`Comercio es: «${word}»`);
    }
  }
  return reasons;
}

function leafStrings(leaf: MessageLeaf): string[] {
  return isPluralMessage(leaf) ? [leaf.one, leaf.other] : [leaf];
}

function scan(tree: MessageTree, locale: 'es' | 'en'): string[] {
  const found: string[] = [];
  for (const key of messageKeys(tree)) {
    const namespace = key.split('.')[0];
    for (const value of leafStrings(messageAt(tree, key) as MessageLeaf)) {
      for (const reason of forbiddenReasons(value, locale, namespace)) {
        found.push(`${locale}.${key} → ${reason}`);
      }
    }
  }
  return found;
}

describe('the dictionaries against the forbidden list of §12.22', () => {
  it('es has no forbidden value', () => {
    expect(scan(es as MessageTree, 'es')).toEqual([]);
  });

  it('en has no forbidden value', () => {
    expect(scan(en as MessageTree, 'en')).toEqual([]);
  });
});

describe('the forbidden list itself', () => {
  const cases: Array<[string, string, 'es' | 'en', string]> = [
    ['provenance', 'Fuente: hoja del propietario', 'es', 'pokedex'],
    ['filler', 'Próximamente en la wiki', 'es', 'home'],
    ['internal identifier', 'Sin snapshot OTMM', 'es', 'guild'],
    ['the Temporal API', 'Calculado con Temporal', 'es', 'tools'],
    ['a JavaScript artefact', 'undefined', 'es', 'ui'],
    ['the currency written as KK', 'Precio en KKs', 'es', 'trade'],
    ['a hard-coded pixel size', 'Mide 32 px', 'es', 'ui'],
    ['a decorative arrow', 'Ver más ↗', 'es', 'home'],
    ['an emoji', 'Listo 🎉', 'es', 'ui'],
    ['an exclamation', 'Bienvenido!', 'es', 'home'],
    ['English interface copy in es', 'Hold Shift to pin', 'es', 'ui'],
    ['a Spanish design-system default in en', 'Mantén Shift para fijar', 'en', 'ui'],
    ['a whole-value match in en', 'Lista', 'en', 'ui'],
    ['a promise in the Spanish copy of Comercio', 'Vendedor confiable', 'es', 'trade'],
  ];

  for (const [reason, value, locale, namespace] of cases) {
    it(`catches ${reason}`, () => {
      expect(forbiddenReasons(value, locale, namespace)).not.toEqual([]);
    });
  }

  it('leaves the approved copy alone', () => {
    const approved: Array<[string, 'es' | 'en', string]> = [
      ['Mantén Shift para fijar', 'es', 'ui'],
      ['Hold Shift to pin', 'en', 'ui'],
      ['Ctrl + K', 'es', 'shell'],
      [
        'Alliance Codex es un proyecto comunitario independiente, no afiliado a PokeAlliance.',
        'es',
        'shell',
      ],
      ['Todos los ítems', 'es', 'items'],
      ['Close Combat', 'en', 'pokemon'],
      ['Lista', 'es', 'ui'],
      ['Breadcrumb', 'en', 'shell'],
      ['Vista', 'es', 'ui'],
      ['Paginación', 'es', 'ui'],
    ];
    const found = approved.flatMap(([value, locale, namespace]) =>
      forbiddenReasons(value, locale, namespace).map((r) => `${locale} «${value}» → ${r}`),
    );
    expect(found).toEqual([]);
  });
});
