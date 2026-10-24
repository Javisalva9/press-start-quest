import type { FreeGame } from '@psq/shared';
import { useTranslation } from 'react-i18next';
import { useFreeGames } from '../api/deals';

/**
 * "Free this week": games the official stores give away now, as a row
 * to swipe through. Hidden when there are none (or it fails): it's a
 * bonus on top of the deals, not something to wait for.
 */
export function FreeGamesSection() {
  const { t } = useTranslation();
  const free = useFreeGames();
  const items = free.data?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold">
        {t('deals.free.title')}
      </h2>
      {/* A row to swipe on a phone; a grid on wider screens, with no scrollbar. */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {items.map((game) => (
          <li key={game.id} className="w-60 shrink-0 snap-start sm:w-auto">
            <FreeGameCard game={game} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FreeGameCard({ game }: { game: FreeGame }) {
  const { t, i18n } = useTranslation();
  return (
    <a
      href={game.url}
      target="_blank"
      rel="noreferrer"
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card"
    >
      <img
        src={game.imageUrl}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover"
      />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate font-semibold">{game.title}</p>
        <p className="text-xs text-muted">
          {[
            game.stores.join(' · '),
            game.endsAt
              ? t('deals.endsOn', {
                  date: new Intl.DateTimeFormat(i18n.language, {
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(game.endsAt)),
                })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {game.owned ? (
            <span className="text-xs font-semibold text-muted">
              {t('deals.free.owned')}
            </span>
          ) : game.wanted ? (
            <span className="text-xs font-semibold text-star">
              {t('deals.free.wanted')}
            </span>
          ) : (
            // GamerPower's worth is in dollars: left out, the app is in euros.
            <span />
          )}
          <span className="shrink-0 text-sm font-semibold text-success">
            {t('deals.free.get')}
          </span>
        </div>
      </div>
    </a>
  );
}
