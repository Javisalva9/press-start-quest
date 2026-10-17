import { effectiveFinale } from './finale-vote.js';

const base = { byRule: false, yourVote: null, votes: 0, yes: 0 };

describe('effectiveFinale', () => {
  it('follows the rules with no votes', () => {
    expect(effectiveFinale({ ...base, byRule: true })).toEqual({
      finale: true,
      source: 'RULE',
    });
  });

  it("gives the player's own vote the last word, both ways", () => {
    expect(effectiveFinale({ ...base, yourVote: true })).toEqual({
      finale: true,
      source: 'VOTE',
    });
    expect(
      effectiveFinale({
        ...base,
        byRule: true,
        yourVote: false,
        votes: 9,
        yes: 9,
      }),
    ).toEqual({ finale: false, source: 'VOTE' });
  });

  it('takes the consensus with 5 votes and 70 % agreeing, both ways', () => {
    expect(effectiveFinale({ ...base, votes: 5, yes: 4 }).source).toBe(
      'CONSENSUS',
    );
    expect(
      effectiveFinale({ ...base, byRule: true, votes: 10, yes: 2 }),
    ).toEqual({ finale: false, source: 'CONSENSUS' });
  });

  it('ignores too few votes, even if they all agree', () => {
    expect(effectiveFinale({ ...base, votes: 4, yes: 4 })).toEqual({
      finale: false,
      source: 'RULE',
    });
  });

  it('ignores a split vote', () => {
    expect(
      effectiveFinale({ ...base, byRule: true, votes: 10, yes: 5 }),
    ).toEqual({ finale: true, source: 'RULE' });
  });
});
