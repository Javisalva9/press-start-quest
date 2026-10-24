import type { DealPrice } from '@psq/shared';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../deals';

/**
 * "4,99 € ~~19,99 €~~ −75 % · GOG", and the historical low below: the
 * price in the deals list and on a wishlisted game's page.
 */
export function DealPriceLine({ deal }: { deal: DealPrice }) {
  const { t, i18n } = useTranslation();
  const money = (amount: number) =>
    formatPrice(amount, deal.currency, i18n.language);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`font-display text-xl font-bold ${deal.cutPct > 0 ? 'text-success' : ''}`}
        >
          {money(deal.price)}
        </span>
        {deal.cutPct > 0 && (
          <>
            <span className="text-sm text-muted line-through">
              {money(deal.regularPrice)}
            </span>
            <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-bold text-success">
              {t('deals.cut', { cut: deal.cutPct })}
            </span>
          </>
        )}
        <span className="text-sm text-muted">
          {t('deals.at', { store: deal.store })}
        </span>
      </div>
      <p className="text-xs text-muted">
        {deal.isHistoricalLow ? (
          <span className="font-semibold text-star">
            {t('deals.historicalLow')}
          </span>
        ) : deal.lowestPrice !== null ? (
          t('deals.lowest', { price: money(deal.lowestPrice) })
        ) : null}
        {deal.expiresAt && (
          <>
            {deal.isHistoricalLow || deal.lowestPrice !== null
              ? t('deals.separator')
              : ''}
            {t('deals.endsOn', {
              date: new Intl.DateTimeFormat(i18n.language, {
                day: 'numeric',
                month: 'short',
              }).format(new Date(deal.expiresAt)),
            })}
          </>
        )}
      </p>
    </div>
  );
}
