import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, type Query } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { describe, expect, it } from 'vitest';
import { CACHE_MAX_AGE_MS, shouldPersist } from './cache';

describe('shouldPersist', () => {
  it.each([
    [['me']],
    [['stats-overview']],
    [['library', { view: 'library' }]],
    [['library-game', 'ug1']],
    [['external-sources']],
    [['curators']],
    [['achievements', 'ug1']],
    [['review-queue', 1]],
    [['recommendation', null, 0]],
    [['recommendation', 'short', 0]],
  ])('keeps %o', (key) => {
    expect(shouldPersist(key)).toBe(true);
  });

  it.each([
    [['game-search', 'hades']],
    [['sync-job', 'job-1']],
    [['review-queue', 20]],
    [['recommendation', null, 3]],
    [['recommendation-ranking', null]],
    [['something-new']],
  ])('leaves out %o', (key) => {
    expect(shouldPersist(key)).toBe(false);
  });
});

describe('saving and restoring the cache', () => {
  /** An in-memory stand-in for localStorage. */
  const memoryStorage = () => {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    };
  };
  /**
   * Saves in the background (it bundles writes), so the test waits for it,
   * and checks it's really there: otherwise restoring finds nothing and
   * "throws away the old copy" would pass without testing anything.
   */
  const saved = async (storage: ReturnType<typeof memoryStorage>) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(storage.getItem('test')).not.toBeNull();
  };
  const persisterWith = (storage: ReturnType<typeof memoryStorage>) =>
    createSyncStoragePersister({ storage, key: 'test', throttleTime: 0 });
  const options = {
    maxAge: CACHE_MAX_AGE_MS,
    dehydrateOptions: {
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === 'success' && shouldPersist(query.queryKey),
    },
  };

  it('brings back only the kept data, for the same version', async () => {
    const storage = memoryStorage();
    const before = new QueryClient();
    before.setQueryData(['stats-overview'], { completed: 8 });
    before.setQueryData(['game-search', 'hades'], [{ igdbId: 1 }]);
    await persistQueryClientSave({
      queryClient: before,
      persister: persisterWith(storage),
      buster: 'build-1',
      ...options,
    });
    await saved(storage);

    const after = new QueryClient();
    await persistQueryClientRestore({
      queryClient: after,
      persister: persisterWith(storage),
      buster: 'build-1',
      ...options,
    });
    expect(after.getQueryData(['stats-overview'])).toEqual({ completed: 8 });
    expect(after.getQueryData(['game-search', 'hades'])).toBeUndefined();
  });

  it('throws away what an older version saved', async () => {
    const storage = memoryStorage();
    const before = new QueryClient();
    before.setQueryData(['stats-overview'], { completed: 8 });
    await persistQueryClientSave({
      queryClient: before,
      persister: persisterWith(storage),
      buster: 'build-1',
      ...options,
    });
    await saved(storage);

    const after = new QueryClient();
    await persistQueryClientRestore({
      queryClient: after,
      persister: persisterWith(storage),
      buster: 'build-2',
      ...options,
    });
    expect(after.getQueryData(['stats-overview'])).toBeUndefined();
  });
});
