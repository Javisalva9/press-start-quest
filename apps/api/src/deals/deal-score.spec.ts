import { dealScore, type DealCandidate } from './deal-score.js';

const deal = (overrides: Partial<DealCandidate> = {}): DealCandidate => ({
  fit: 0.5,
  rating: 80,
  ratingCount: 1000,
  metacritic: null,
  cutPct: 50,
  isHistoricalLow: false,
  recommended: false,
  ...overrides,
});

describe('dealScore', () => {
  it('adds up the weighted parts', () => {
    // 0.3 × 0.5 + 0.25 × ~0.8 + 0.2 × 0.5 + 0 + 0
    expect(dealScore(deal())).toBeCloseTo(0.449, 2);
  });

  it("puts a good game you like above a cheaper one you don't", () => {
    const yours = dealScore(deal({ fit: 1, rating: 92, cutPct: 40 }));
    const cheap = dealScore(deal({ fit: 0, rating: 60, cutPct: 90 }));
    expect(yours).toBeGreaterThan(cheap);
  });

  it('rewards a historical low and a followed curator', () => {
    expect(dealScore(deal({ isHistoricalLow: true }))).toBeCloseTo(
      dealScore(deal()) + 0.15,
      3,
    );
    expect(dealScore(deal({ recommended: true }))).toBeCloseTo(
      dealScore(deal()) + 0.1,
      3,
    );
  });
});
