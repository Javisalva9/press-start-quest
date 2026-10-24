import { DEFAULT_WEIGHTS } from '@psq/shared';
import { readSettings, toUserSettings } from './user-settings.js';

const mine = { quality: 5, affinity: 5, length: 0, social: 0, momentum: 2 };

describe('readSettings', () => {
  it('reads the weights the player saved', () => {
    expect(readSettings({ weights: mine })).toEqual({ weights: mine });
  });

  it.each([[{}], [null], ['nope'], [[1, 2]]])(
    'reads nothing from an empty or odd column: %o',
    (json) => {
      expect(readSettings(json)).toEqual({});
    },
  );

  it('drops weights that no longer validate, keeping the rest', () => {
    expect(
      readSettings({ weights: { ...mine, quality: 0.3 }, other: 1 }),
    ).toEqual({});
  });
});

describe('toUserSettings', () => {
  it("fills in the plan's weights when the player kept them", () => {
    expect(toUserSettings({})).toEqual({
      weights: DEFAULT_WEIGHTS,
    });
  });

  it('sends the weights the player saved', () => {
    expect(toUserSettings({ weights: mine })).toEqual({
      weights: mine,
    });
  });
});
