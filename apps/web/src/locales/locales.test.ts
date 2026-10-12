import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

// This test is CI's missing-translation alarm: if you add a key in one
// language and not the other, the PR can't be merged.

/** Flattens { a: { b: 'x' } } into [['a.b', 'x']]. */
function entries(node: unknown, path = ''): Array<[string, unknown]> {
  if (typeof node !== 'object' || node === null) {
    return [[path, node]];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    entries(value, path ? `${path}.${key}` : key),
  );
}

// i18next stores plurals as key_one, key_other…, and each language uses the
// forms it needs, so keys are compared without that suffix.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keys(messages: object): Set<string> {
  return new Set(
    entries(messages).map(([key]) => key.replace(PLURAL_SUFFIX, '')),
  );
}

/** The {{placeholders}} in a text, sorted. */
function placeholders(text: unknown): string[] {
  return [...String(text).matchAll(/{{\s*(\w+)/g)]
    .map(([, name]) => name)
    .sort();
}

describe('translations', () => {
  const enKeys = keys(en);
  const esKeys = keys(es);

  it('es.json has every key in en.json', () => {
    expect([...enKeys].filter((key) => !esKeys.has(key))).toEqual([]);
  });

  it('en.json has every key in es.json', () => {
    expect([...esKeys].filter((key) => !enKeys.has(key))).toEqual([]);
  });

  it.each([
    ['en', en],
    ['es', es],
  ])('%s.json has no empty texts', (_language, messages) => {
    const empty = entries(messages)
      .filter(([, text]) => typeof text !== 'string' || text.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('{{…}} placeholders match in both languages', () => {
    const esTexts = new Map(entries(es));
    const mismatched = entries(en)
      .filter(([key]) => esTexts.has(key))
      .filter(
        ([key, text]) =>
          placeholders(text).join() !== placeholders(esTexts.get(key)).join(),
      )
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
