import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCuratorFiles } from './curator-file.js';

/** A temporary data/curators folder with the given files. */
const folderWith = (files: Record<string, unknown>) => {
  const dir = mkdtempSync(join(tmpdir(), 'curators-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(content));
  }
  return pathToFileURL(`${dir}/`);
};

const list = {
  curator: { name: 'Someone', kind: 'CREATOR', color: '#F59E0B' },
  games: [{ igdbId: 1, title: 'A', year: 2020, listedAs: ['A'] }],
};

describe('loadCuratorFiles', () => {
  it('the lists in the repository are valid', () => {
    const files = loadCuratorFiles();
    expect(files.map((file) => file.curator.name)).toContain('AlexElCapso');
    // The source lists (hand-written, before IGDB) are not loaded.
    expect(files.every((file) => file.games.length > 0)).toBe(true);
  });

  it('loads the resolved lists, not the source ones', () => {
    const files = loadCuratorFiles(
      folderWith({
        'someone.json': list,
        'someone.source.json': { entries: [] },
      }),
    );
    expect(files).toHaveLength(1);
  });

  it('rejects a list with a bad color', () => {
    expect(() =>
      loadCuratorFiles(
        folderWith({
          'someone.json': {
            ...list,
            curator: { ...list.curator, color: 'amber' },
          },
        }),
      ),
    ).toThrow();
  });
});
