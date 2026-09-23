// Contract of the message dictionaries (spec §13.2). Every leaf is a plain
// string with `{name}` placeholders, or a plural entry — never a function — so
// a namespace can travel to a React island as a serializable prop.

import type { Locale } from '../config';

export interface PluralMessage {
  readonly one: string;
  readonly other: string;
}

export type MessageLeaf = string | PluralMessage;

export interface MessageTree {
  readonly [key: string]: MessageLeaf | MessageTree;
}

/**
 * The same tree with every string literal widened, so `en.ts` has to mirror
 * `es.ts` key by key: a missing or extra key is a type error.
 */
export type Translated<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends PluralMessage
      ? PluralMessage
      : T[K] extends object
        ? Translated<T[K]>
        : never;
};

const PLACEHOLDER = /\{(\w+)\}/g;

export function isPluralMessage(value: unknown): value is PluralMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralMessage).one === 'string' &&
    typeof (value as PluralMessage).other === 'string'
  );
}

/**
 * Replaces `{name}` placeholders with the given values. A missing variable
 * throws in development so the gap shows up while writing the page; in
 * production the raw placeholder is kept instead of rendering an empty string.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      if (import.meta.env.DEV) {
        throw new Error(`i18n: missing variable "${name}" for the message "${template}".`);
      }
      return placeholder;
    }
    return String(vars[name]);
  });
}

/**
 * Picks the plural form for `count` with `Intl.PluralRules`. It returns the
 * template: the caller fills `{n}` with the number already formatted by
 * `src/lib/format/numbers.ts`, because the dictionaries never group digits.
 */
export function plural(locale: Locale, count: number, entry: PluralMessage): string {
  return new Intl.PluralRules(locale).select(count) === 'one' ? entry.one : entry.other;
}

/** Every leaf of a tree as `namespace.key`, in declaration order. */
export function messageKeys(tree: MessageTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralMessage(value)) {
      keys.push(path);
    } else {
      keys.push(...messageKeys(value as MessageTree, path));
    }
  }
  return keys;
}

/** The leaf at `namespace.key`, or `undefined` when the path does not exist. */
export function messageAt(tree: MessageTree, path: string): MessageLeaf | undefined {
  let current: MessageLeaf | MessageTree | undefined = tree;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || isPluralMessage(current)) {
      return undefined;
    }
    current = (current as MessageTree)[segment];
  }
  return typeof current === 'string' || isPluralMessage(current) ? current : undefined;
}
