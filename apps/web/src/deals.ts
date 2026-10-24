import type { Deal } from '@psq/shared';

/** How the deals screen orders the list. */
export const DEAL_SORTS = ['forYou', 'cut', 'price'] as const;

export type DealSort = (typeof DEAL_SORTS)[number];

/**
 * The list the screen shows: on sale only (unless asked for every price),
 * in the chosen order. Ties go by title, so the order never jumps.
 */
export function visibleDeals(
  deals: Deal[],
  sort: DealSort,
  onSaleOnly: boolean,
): Deal[] {
  const shown = onSaleOnly ? deals.filter((deal) => deal.cutPct > 0) : deals;
  const by: Record<DealSort, (a: Deal, b: Deal) => number> = {
    forYou: (a, b) => b.score - a.score,
    cut: (a, b) => b.cutPct - a.cutPct || a.price - b.price,
    price: (a, b) => a.price - b.price,
  };
  return [...shown].sort(
    (a, b) => by[sort](a, b) || a.title.localeCompare(b.title),
  );
}

/** "4,99 €" / "€4.99", in the player's language. */
export function formatPrice(
  amount: number,
  currency: string,
  language: string,
): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
  }).format(amount);
}
