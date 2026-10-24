import type { Deal } from '@psq/shared';
import { describe, expect, it } from 'vitest';
import { formatPrice, visibleDeals } from './deals';

const deal = (title: string, overrides: Partial<Deal> = {}): Deal => ({
  id: title,
  title,
  coverUrl: null,
  heroUrl: null,
  store: 'GOG',
  price: 10,
  regularPrice: 20,
  cutPct: 50,
  currency: 'EUR',
  url: 'https://itad.link/x/',
  isHistoricalLow: false,
  lowestPrice: null,
  expiresAt: null,
  rating: null,
  wishlistPriority: null,
  recommendedBy: [],
  fit: 0.5,
  topTag: null,
  score: 0.5,
  ...overrides,
});

const titles = (deals: Deal[]) => deals.map((item) => item.title);

describe('visibleDeals', () => {
  const list = [
    deal('Cheap', { price: 2, cutPct: 80, score: 0.3 }),
    deal('Liked', { price: 15, cutPct: 40, score: 0.9 }),
    deal('Full', { price: 9, cutPct: 0, score: 0.6 }),
  ];

  it('shows only games on sale, "for you" first', () => {
    expect(titles(visibleDeals(list, 'forYou', true))).toEqual([
      'Liked',
      'Cheap',
    ]);
  });

  it('orders by discount or by price, with every price if asked', () => {
    expect(titles(visibleDeals(list, 'cut', false))).toEqual([
      'Cheap',
      'Liked',
      'Full',
    ]);
    expect(titles(visibleDeals(list, 'price', false))).toEqual([
      'Cheap',
      'Full',
      'Liked',
    ]);
  });
});

describe('formatPrice', () => {
  it('writes euros the way each language does', () => {
    // Spanish puts a non-breaking space before the euro sign.
    expect(formatPrice(4.99, 'EUR', 'es')).toBe('4,99\u00a0€');
    expect(formatPrice(4.99, 'EUR', 'en')).toBe('€4.99');
  });
});
