import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

// Este test es el aviso del CI si falta una traducción: si añades una clave en
// un idioma y no en el otro, la PR no se puede fusionar.

/** Aplana { a: { b: 'x' } } en [['a.b', 'x']]. */
function entries(node: unknown, path = ''): Array<[string, unknown]> {
  if (typeof node !== 'object' || node === null) {
    return [[path, node]];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    entries(value, path ? `${path}.${key}` : key),
  );
}

// i18next guarda los plurales como clave_one, clave_other…, y cada idioma usa
// las formas que necesita: se comparan las claves sin ese sufijo.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keys(messages: object): Set<string> {
  return new Set(
    entries(messages).map(([key]) => key.replace(PLURAL_SUFFIX, '')),
  );
}

/** Variables {{así}} de un texto, ordenadas. */
function placeholders(text: unknown): string[] {
  return [...String(text).matchAll(/{{\s*(\w+)/g)]
    .map(([, name]) => name)
    .sort();
}

describe('traducciones', () => {
  const enKeys = keys(en);
  const esKeys = keys(es);

  it('es.json tiene todas las claves de en.json', () => {
    expect([...enKeys].filter((key) => !esKeys.has(key))).toEqual([]);
  });

  it('en.json tiene todas las claves de es.json', () => {
    expect([...esKeys].filter((key) => !enKeys.has(key))).toEqual([]);
  });

  it.each([
    ['en', en],
    ['es', es],
  ])('%s.json no tiene textos vacíos', (_language, messages) => {
    const empty = entries(messages)
      .filter(([, text]) => typeof text !== 'string' || text.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('las variables {{…}} coinciden en los dos idiomas', () => {
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
