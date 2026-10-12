import { GAME_STATUSES, PLATFORMS } from '@psq/shared';
import { GameStatus, Platform } from '../generated/prisma/client.js';

// The shared package repeats some database enums so the web app can use
// them. If a migration adds a value, these tests say where to add it too.
describe('enums shared with the web app', () => {
  it('GAME_STATUSES matches the GameStatus enum', () => {
    expect([...GAME_STATUSES].sort()).toEqual(Object.values(GameStatus).sort());
  });

  it('PLATFORMS matches the Platform enum', () => {
    expect([...PLATFORMS].sort()).toEqual(Object.values(Platform).sort());
  });
});
