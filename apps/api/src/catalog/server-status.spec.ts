import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadServerStatusSeed,
  serverStatusOn,
  type ServerStatusEntry,
} from './server-status.js';

const entry: ServerStatusEntry = {
  steamAppId: 1,
  title: 'Some Game',
  closesOn: '2026-02-25',
  after: 'CLOSED',
  note: 'Online only.',
  source: 'https://example.com/news',
};

/** Writes a seed file to a temporary folder and returns its URL. */
const seedFile = (content: unknown) => {
  const path = join(mkdtempSync(join(tmpdir(), 'seed-')), 'seed.json');
  writeFileSync(path, JSON.stringify(content));
  return pathToFileURL(path);
};

describe('server status seed', () => {
  it('the list in the repository is valid', () => {
    expect(loadServerStatusSeed().length).toBeGreaterThan(0);
  });

  it('rejects an unknown status', () => {
    expect(() =>
      loadServerStatusSeed(seedFile([{ ...entry, after: 'GONE' }])),
    ).toThrow();
  });

  it('rejects the same game twice', () => {
    expect(() => loadServerStatusSeed(seedFile([entry, entry]))).toThrow(
      /Duplicated app id 1/,
    );
  });
});

describe('serverStatusOn', () => {
  it('is ANNOUNCED before the closing day', () => {
    expect(serverStatusOn(entry, new Date('2026-02-24T23:59:59Z'))).toEqual({
      status: 'ANNOUNCED',
      closedAt: new Date('2026-02-25T00:00:00Z'),
    });
  });

  it('turns into what is left on the closing day, with no edit', () => {
    expect(serverStatusOn(entry, new Date('2026-02-25T00:00:00Z')).status).toBe(
      'CLOSED',
    );
    expect(
      serverStatusOn(
        { ...entry, after: 'PARTIAL' },
        new Date('2026-10-15T00:00:00Z'),
      ).status,
    ).toBe('PARTIAL');
  });
});
