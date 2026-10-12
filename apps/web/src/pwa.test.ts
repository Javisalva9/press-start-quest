import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInstalledApp, isTouchDevice } from './pwa';

/** Fakes the browser's media queries: the ones listed match. */
function mediaMatching(...queries: string[]) {
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({ matches: queries.includes(query) }),
  });
}

describe('pwa helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects the installed app', () => {
    vi.stubGlobal('navigator', {});
    mediaMatching('(display-mode: standalone)');
    expect(isInstalledApp()).toBe(true);
  });

  it('detects the installed app on older iPhones', () => {
    vi.stubGlobal('navigator', { standalone: true });
    mediaMatching();
    expect(isInstalledApp()).toBe(true);
  });

  it('knows a browser tab is not the installed app', () => {
    vi.stubGlobal('navigator', {});
    mediaMatching();
    expect(isInstalledApp()).toBe(false);
  });

  it('detects touch devices', () => {
    mediaMatching('(pointer: coarse)');
    expect(isTouchDevice()).toBe(true);
  });
});
