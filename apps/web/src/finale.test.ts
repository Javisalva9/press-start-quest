import { describe, expect, it } from 'vitest';
import { finaleAction, finaleSourceKey } from './finale';

const finale = (
  isFinale: boolean,
  source: 'VOTE' | 'CONSENSUS' | 'RULE',
  yourVote: boolean | null = null,
) => ({ isFinale, source, byRule: false, yourVote });

describe('finaleAction', () => {
  it('offers to mark as the ending what is not', () => {
    expect(finaleAction(finale(false, 'RULE'))).toEqual({
      key: 'achievements.markFinale',
      vote: true,
    });
  });

  it('offers to correct an ending set by the rules or the community', () => {
    expect(finaleAction(finale(true, 'RULE')).vote).toBe(false);
    expect(finaleAction(finale(true, 'CONSENSUS')).vote).toBe(false);
  });

  it('offers to take back a vote already given, either way', () => {
    expect(finaleAction(finale(true, 'VOTE', true))).toEqual({
      key: 'achievements.takeBackVote',
      vote: null,
    });
    expect(finaleAction(finale(false, 'VOTE', false)).vote).toBeNull();
  });
});

describe('finaleSourceKey', () => {
  it('names who decided', () => {
    expect(finaleSourceKey('VOTE')).toBe('achievements.byYou');
    expect(finaleSourceKey('CONSENSUS')).toBe('achievements.byCommunity');
    expect(finaleSourceKey('RULE')).toBe('achievements.byRules');
  });
});
