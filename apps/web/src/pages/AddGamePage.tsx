import {
  OWNED_STATUSES,
  type GameSearchResult,
  type OwnedStatus,
} from '@psq/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../api/client';
import {
  useAddManualGame,
  useExternalSources,
  useGameSearch,
} from '../api/manual';
import { parseHours } from '../format';

const inputClass =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg';

/**
 * Add a game by hand: search IGDB, pick one, and say where it comes from:
 * not owned ("I want it") or owned in a store the app doesn't sync, with
 * the hours played and, if wanted, its status.
 */
export default function AddGamePage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  // The search waits 300 ms after the last key: one request per search.
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const search = useGameSearch(query);
  const [picked, setPicked] = useState<GameSearchResult | null>(null);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-6 pb-24">
      <Link to="/library" className="text-sm text-muted">
        {t('game.back')}
      </Link>
      <h1 className="font-display text-2xl font-bold">{t('add.title')}</h1>

      {picked ? (
        <AddForm game={picked} onCancel={() => setPicked(null)} />
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('add.searchLabel')}</span>
            <input
              type="search"
              value={text}
              autoFocus
              onChange={(event) => setText(event.target.value)}
              placeholder={t('add.searchPlaceholder')}
              className={inputClass}
            />
          </label>

          {search.isError && (
            <p role="alert" className="text-sm text-danger">
              {t(
                `errors.${
                  search.error instanceof ApiRequestError && search.error.code
                    ? search.error.code
                    : 'UNKNOWN'
                }`,
              )}
            </p>
          )}
          {search.data?.length === 0 && (
            <p className="text-sm text-muted">{t('add.noResults')}</p>
          )}

          <ul className="flex flex-col gap-2">
            {search.data?.map((result) => (
              <li key={result.igdbId}>
                <button
                  type="button"
                  onClick={() => setPicked(result)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-2 text-left transition hover:border-muted"
                >
                  <Thumbnail result={result} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {result.title}
                    </span>
                    {result.releaseYear && (
                      <span className="text-xs text-muted">
                        {result.releaseYear}
                      </span>
                    )}
                  </span>
                  {result.inLibrary && (
                    <span className="shrink-0 rounded-full bg-fg/10 px-2 py-0.5 text-xs">
                      {t(`add.inLibrary.${result.inLibrary}`)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Thumbnail({ result }: { result: GameSearchResult }) {
  return result.coverUrl ? (
    <img
      src={result.coverUrl}
      alt=""
      loading="lazy"
      className="h-16 w-12 shrink-0 rounded object-cover"
    />
  ) : (
    <span className="h-16 w-12 shrink-0 rounded bg-fg/10" aria-hidden />
  );
}

/** Where the picked game comes from, and how it's going. */
function AddForm({
  game,
  onCancel,
}: {
  game: GameSearchResult;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sources = useExternalSources();
  const add = useAddManualGame();

  const owned = game.inLibrary === 'owned';
  // A game already owned can't be wished for: only added from another store.
  const [origin, setOrigin] = useState<'wishlist' | 'external'>(
    owned ? 'external' : 'wishlist',
  );
  // Null until the player types: meanwhile, their first store is offered.
  const [typedSource, setTypedSource] = useState<string | null>(null);
  const sourceName = typedSource ?? sources.data?.[0]?.name ?? '';
  const [hours, setHours] = useState('');
  const [status, setStatus] = useState<OwnedStatus | ''>('');

  const minutes = hours.trim() ? parseHours(hours) : undefined;
  const invalid =
    origin === 'external' && (!sourceName.trim() || minutes === null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) {
      return;
    }
    add.mutate(
      origin === 'wishlist'
        ? { origin, igdbId: game.igdbId }
        : {
            origin,
            igdbId: game.igdbId,
            sourceName: sourceName.trim(),
            playtimeMinutes: minutes ?? undefined,
            status: status || undefined,
          },
      { onSuccess: (added) => navigate(`/library/${added.id}`) },
    );
  };

  const errorCode =
    add.error instanceof ApiRequestError && add.error.code
      ? add.error.code
      : add.error
        ? 'UNKNOWN'
        : null;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4"
    >
      <div className="flex items-center gap-3">
        <Thumbnail result={game} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">
            {game.title}
          </p>
          {game.releaseYear && (
            <p className="text-sm text-muted">{game.releaseYear}</p>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted">
          {t('add.originLabel')}
        </legend>
        <label
          className={`flex items-center gap-2 ${owned ? 'opacity-50' : ''}`}
        >
          <input
            type="radio"
            name="origin"
            checked={origin === 'wishlist'}
            disabled={owned}
            onChange={() => setOrigin('wishlist')}
          />
          {t('add.originWishlist')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="origin"
            checked={origin === 'external'}
            onChange={() => setOrigin('external')}
          />
          {t('add.originExternal')}
        </label>
      </fieldset>

      {origin === 'external' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('add.sourceLabel')}</span>
            {/* Free text with the existing stores as suggestions. */}
            <input
              list="external-sources"
              value={sourceName}
              maxLength={40}
              onChange={(event) => setTypedSource(event.target.value)}
              placeholder={t('add.sourcePlaceholder')}
              className={inputClass}
            />
            <datalist id="external-sources">
              {sources.data?.map((source) => (
                <option key={source.id} value={source.name} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('add.hoursLabel')}</span>
            <input
              inputMode="decimal"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              placeholder="0"
              className={inputClass}
            />
            {minutes === null && (
              <span className="text-xs text-danger">
                {t('add.hoursInvalid')}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('game.statusLabel')}</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as OwnedStatus | '')
              }
              className={inputClass}
            >
              <option value="">{t('add.statusAutomatic')}</option>
              {OWNED_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {errorCode && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${errorCode}`)}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-line px-4 py-2 font-semibold"
        >
          {t('add.back')}
        </button>
        <button
          type="submit"
          disabled={invalid || add.isPending}
          className="flex-1 rounded-xl bg-linear-to-r from-violet to-cyan px-4 py-2 font-semibold text-canvas disabled:opacity-50"
        >
          {add.isPending ? t('add.adding') : t('add.submit')}
        </button>
      </div>
    </form>
  );
}
