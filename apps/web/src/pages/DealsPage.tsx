import type { Deal } from '@psq/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useDeals } from '../api/deals';
import { CuratorLabel } from '../components/CuratorLabel';
import { DealPriceLine } from '../components/DealPriceLine';
import { FreeGamesSection } from '../components/FreeGamesSection';
import { GameCover } from '../components/GameCover';
import { DEAL_SORTS, visibleDeals, type DealSort } from '../deals';
import { tagLabel } from '../tag-names';

/**
 * Deals: the games you want ("Lo quiero") that are cheaper today, in the
 * official stores. "For you" first: your kind of game and a good one
 * beats a big discount on something you'd never play.
 */
export default function DealsPage() {
  const { t, i18n } = useTranslation();
  const deals = useDeals();
  const [sort, setSort] = useState<DealSort>('forYou');
  const [onSaleOnly, setOnSaleOnly] = useState(true);
  const shown = deals.data
    ? visibleDeals(deals.data.items, sort, onSaleOnly)
    : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-6 pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t('deals.title')}</h1>
        <p className="text-sm text-muted">{t('deals.intro')}</p>
      </header>

      <FreeGamesSection />

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t('deals.sortLabel')}
          className="flex gap-2"
        >
          {DEAL_SORTS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={sort === option}
              onClick={() => setSort(option)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                sort === option
                  ? 'border-cyan bg-cyan/15 text-fg'
                  : 'border-line text-muted hover:text-fg'
              }`}
            >
              {t(`deals.sort.${option}`)}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={(event) => setOnSaleOnly(event.target.checked)}
            className="accent-cyan"
          />
          {t('deals.onSaleOnly')}
        </label>
      </div>

      {deals.isPending ? (
        <div aria-busy className="h-96 animate-pulse rounded-2xl bg-card" />
      ) : deals.isError ? (
        <p className="text-sm text-muted">{t('deals.error')}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          {deals.data.items.length === 0
            ? t('deals.emptyWishlist')
            : t('deals.emptyOnSale')}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {shown.map((deal) => (
              <li key={deal.id}>
                <DealCard deal={deal} />
              </li>
            ))}
          </ul>
          {deals.data.updatedAt && (
            <p className="text-xs text-muted">
              {t('deals.updatedAt', {
                date: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(deals.data.updatedAt)),
              })}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const { t, i18n } = useTranslation();
  // Why it's here, besides the price: taste first, then the rating.
  const why = [
    deal.topTag && deal.fit >= 0.5
      ? t('next.reason.TASTE_MATCH', {
          tag: tagLabel(deal.topTag.name, i18n.language),
        })
      : null,
    deal.rating !== null && deal.rating >= 85
      ? t('next.reason.HIGHLY_RATED', { rating: Math.round(deal.rating) })
      : null,
  ].filter((text): text is string => text !== null);

  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-card p-3">
      <Link to={`/library/${deal.id}`} className="w-20 shrink-0">
        <GameCover
          title={deal.title}
          coverUrl={deal.coverUrl}
          heroUrl={deal.heroUrl}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link
          to={`/library/${deal.id}`}
          className="truncate font-semibold leading-tight"
        >
          {deal.title}
        </Link>
        <DealPriceLine deal={deal} />
        {(why.length > 0 || deal.recommendedBy.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {why.length > 0 && (
              <span className="text-xs text-fg/80">{why.join(' · ')}</span>
            )}
            {deal.recommendedBy.map((curator) => (
              <CuratorLabel key={curator.name} curator={curator} />
            ))}
          </div>
        )}
        <a
          href={deal.url}
          target="_blank"
          rel="noreferrer"
          className="self-start text-sm font-semibold text-cyan"
        >
          {t('deals.open', { store: deal.store })}
        </a>
      </div>
    </article>
  );
}
