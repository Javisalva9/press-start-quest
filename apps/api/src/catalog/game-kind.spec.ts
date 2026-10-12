import { classifyGameKind } from './game-kind.js';

describe('classifyGameKind', () => {
  it.each([
    ['Portal 2', 'game', 'GAME'],
    ['Black Mesa', 'mod', 'GAME'],
    ['Portal 2 - Peer Review', 'dlc', 'DLC'],
    ['Hades Demo', 'demo', 'DEMO'],
    ['Celeste Original Soundtrack', 'music', 'SOUNDTRACK'],
    ['Half-Life: Alyx Final Hours', 'video', 'TOOL'],
  ])('uses the store type: %s (%s) → %s', (title, storeType, kind) => {
    expect(classifyGameKind({ title, storeType })).toBe(kind);
  });

  it.each([
    ['Marvel Rivals Playtest', 'PLAYTEST'],
    ['HUMANKIND™ - Closed Beta', 'PLAYTEST'],
    ['Some Game Open Beta', 'PLAYTEST'],
    ['Hollow Knight OST', 'SOUNDTRACK'],
    ['Cuphead (Demo)', 'DEMO'],
    ['ARK Dedicated Server', 'TOOL'],
    ['Source SDK Base 2013', 'TOOL'],
    ['Stardew Valley', 'GAME'],
  ])('uses the name when there is no store page: %s → %s', (title, kind) => {
    expect(classifyGameKind({ title })).toBe(kind);
  });

  it('checks the name when the store says game (Playtests are labelled game)', () => {
    expect(
      classifyGameKind({ title: 'Some Game Playtest', storeType: 'game' }),
    ).toBe('PLAYTEST');
  });

  it('trusts any other store type over the name', () => {
    expect(
      classifyGameKind({ title: 'Old Game Soundtrack', storeType: 'dlc' }),
    ).toBe('DLC');
  });

  it.each([
    "Demon's Souls",
    'Demolish & Build',
    'Ghostrunner',
    'Lost Ark',
    'Beta Decay',
  ])('does not misread names that only look similar: %s', (title) => {
    expect(classifyGameKind({ title })).toBe('GAME');
  });
});
