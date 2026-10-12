import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import {
  GAME_STATUSES,
  LENGTH_BUCKETS,
  LIBRARY_SORTS,
  type GameStatus,
  type LibraryItem,
} from '@psq/shared';
import {
  filtersFromSearchParams,
  toSearchParams,
  useLibrary,
  type LibraryFilters,
} from '../api/library';
import { GameCover } from '../components/GameCover';
import { formatHours } from '../format';

/** Statuses offered as filters in "My games" (WISHLIST has its own view). */
const LIBRARY_STATUSES = GAME_STATUSES.filter(
  (status) => status !== 'WISHLIST',
);

const selectClass =
  'rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg';

export default function LibraryPage() {
  const { t } = useTranslation();
  // The filters live in the URL: going back, reloading or sharing a link
  // keeps them.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromSearchParams(searchParams);
  // Always computed from the latest URL (not from this render's filters),
  // so a change made a moment later never brings back an older value.
  const setFilters = (changes: Partial<LibraryFilters>) =>
    setSearchParams(
      (current) =>
        toSearchParams({ ...filtersFromSearchParams(current), ...changes }),
      { replace: true },
    );

  // The search box updates the URL 300 ms after the last keystroke, not on
  // every key: one request per search instead of one per letter.
  const [text, setText] = useState(filters.q ?? '');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const search = (value: string) => {
    setText(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setFilters({ q: value.trim() || undefined }),
      300,
    );
  };
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const library = useLibrary(filters);
  const items = library.data?.pages.flatMap((page) => page.items) ?? [];
  const total = library.data?.pages[0]?.total;
  const isWishlist = filters.view === 'wishlist';

  const toggleStatus = (status: GameStatus) => {
    const current = filters.status ?? [];
    const next = current.includes(status)
      ? current.filter((value) => value !== status)
      : [...current, status];
    setFilters({ status: next.length > 0 ? next : undefined });
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-6 pb-24">
      <h1 className="font-display text-2xl font-bold">{t('library.title')}</h1>

      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-card p-1">
        {(['library', 'wishlist'] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={filters.view === view}
            onClick={() =>
              setFilters({
                view,
                status: undefined,
                sort: view === 'wishlist' ? 'priority' : 'lastPlayed',
              })
            }
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              filters.view === view ? 'bg-canvas text-fg' : 'text-muted'
            }`}
          >
            {t(`library.view.${view}`)}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={text}
        onChange={(event) => search(event.target.value)}
        placeholder={t('library.search')}
        aria-label={t('library.search')}
        className="rounded-lg border border-line bg-card px-3 py-2"
      />

      {!isWishlist && (
        <div className="flex flex-wrap gap-2">
          {LIBRARY_STATUSES.map((status) => {
            const active = filters.status?.includes(status) ?? false;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  active
                    ? 'border-cyan bg-cyan/15 text-fg'
                    : 'border-line text-muted'
                }`}
              >
                {t(`status.${status}`)}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t('library.length.label')}
          value={filters.length ?? ''}
          onChange={(event) =>
            setFilters({
              length: (event.target.value ||
                undefined) as LibraryFilters['length'],
            })
          }
          className={selectClass}
        >
          <option value="">{t('library.length.any')}</option>
          {LENGTH_BUCKETS.map((bucket) => (
            <option key={bucket} value={bucket}>
              {t(`library.length.${bucket}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('library.sort.label')}
          value={filters.sort}
          onChange={(event) =>
            setFilters({ sort: event.target.value as LibraryFilters['sort'] })
          }
          className={selectClass}
        >
          {LIBRARY_SORTS.filter(
            (sort) => isWishlist || sort !== 'priority',
          ).map((sort) => (
            <option key={sort} value={sort}>
              {t(`library.sort.${sort}`)}
            </option>
          ))}
        </select>
      </div>

      {total !== undefined && (
        <p className="text-sm text-muted">
          {t('library.count', { count: total })}
        </p>
      )}

      {library.isError ? (
        <p role="alert" className="text-danger">
          {t('errors.UNKNOWN')}
        </p>
      ) : library.isPending ? (
        <p className="text-muted">{t('home.loading')}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-muted">{t('library.empty')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => (
            <li key={item.id}>
              <GameCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {library.hasNextPage && (
        <button
          type="button"
          onClick={() => void library.fetchNextPage()}
          disabled={library.isFetchingNextPage}
          className="mx-auto rounded-xl border border-line px-5 py-2 font-semibold disabled:opacity-60"
        >
          {library.isFetchingNextPage
            ? t('home.loading')
            : t('library.loadMore')}
        </button>
      )}
    </main>
  );
}

function GameCard({ item }: { item: LibraryItem }) {
  const { t, i18n } = useTranslation();
  const played =
    item.playtimeMinutes > 0
      ? t('library.played', {
          hours: formatHours(item.playtimeMinutes, i18n.language),
        })
      : t('library.notPlayed');
  return (
    <Link to={`/library/${item.id}`} className="group flex flex-col gap-1">
      <GameCover
        title={item.title}
        coverUrl={item.coverUrl}
        heroUrl={item.heroUrl}
        className="transition group-hover:border-cyan"
      />
      <span className="line-clamp-2 text-sm leading-tight font-semibold">
        {item.title}
      </span>
      <span className="text-xs text-muted">
        {item.owned ? played : t(`status.${item.status}`)}
        {item.lengthMinutes !== null &&
          t('library.lengthSuffix', {
            hours: formatHours(item.lengthMinutes, i18n.language),
          })}
      </span>
    </Link>
  );
}
