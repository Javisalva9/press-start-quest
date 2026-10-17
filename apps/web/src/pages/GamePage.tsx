import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  OWNED_STATUSES,
  PICKABLE_GAME_TYPES,
  PICKABLE_SERVER_STATUSES,
  type LibraryGame,
} from '@psq/shared';
import { ApiRequestError } from '../api/client';
import {
  toSearchParams,
  useLibraryGame,
  useRemoveFromWishlist,
  useSetLength,
  useUpdateLibraryGame,
} from '../api/library';
import { AchievementsSection } from '../components/AchievementsSection';
import { CuratorLabel } from '../components/CuratorLabel';
import { GameCover } from '../components/GameCover';
import { formatHours, yearOf } from '../format';

export default function GamePage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const game = useLibraryGame(id);

  // Back to the list with its filters when coming from it; to the library
  // when the page was opened directly (a shared link, a reload…).
  const goBack = () =>
    location.key === 'default' ? navigate('/library') : navigate(-1);

  if (game.isPending) {
    // The page's shape while it loads: header image, title, two blocks.
    return (
      <main
        aria-busy
        aria-label={t('home.loading')}
        className="mx-auto flex max-w-3xl animate-pulse flex-col gap-4 pb-24"
      >
        <div className="aspect-[460/215] bg-card" />
        <div className="flex flex-col gap-4 px-4">
          <div className="h-8 w-2/3 rounded-lg bg-card" />
          <div className="h-24 rounded-2xl bg-card" />
          <div className="h-40 rounded-2xl bg-card" />
        </div>
      </main>
    );
  }
  // An error only without data: if the API fails, what's saved stays.
  if (game.isError && !game.data) {
    const code =
      game.error instanceof ApiRequestError && game.error.code
        ? game.error.code
        : 'UNKNOWN';
    return (
      <p role="alert" className="p-6 text-danger">
        {t(`errors.${code}`)}
      </p>
    );
  }

  const data = game.data;
  const hours = (minutes: number) => formatHours(minutes, i18n.language);
  const facts: Array<[string, string]> = [
    [
      t('game.played'),
      data.playtimeMinutes > 0
        ? hours(data.playtimeMinutes)
        : t('library.notPlayed'),
    ],
    ...(data.lengthMinutes !== null
      ? [[t('game.length'), hours(data.lengthMinutes)] as [string, string]]
      : []),
    ...(data.achievements && data.achievements.total > 0
      ? [
          [
            t('game.achievements'),
            t('game.achievementsValue', data.achievements),
          ] as [string, string],
        ]
      : []),
    ...(data.rating !== null
      ? [
          [t('game.rating'), String(Math.round(data.rating))] as [
            string,
            string,
          ],
        ]
      : []),
    ...(data.metacritic !== null
      ? [[t('game.metacritic'), String(data.metacritic)] as [string, string]]
      : []),
    ...(yearOf(data.releaseDate) !== null
      ? [
          [t('game.released'), String(yearOf(data.releaseDate))] as [
            string,
            string,
          ],
        ]
      : []),
  ];
  const tags = [...data.genres, ...data.themes];

  return (
    <main className="mx-auto max-w-3xl pb-24">
      <div className="relative">
        {data.heroUrl ? (
          <img
            src={data.heroUrl}
            alt=""
            className="h-48 w-full object-cover sm:h-64"
          />
        ) : (
          // No wide Steam image yet (games from IGDB get it on the next
          // sync): the cover, blurred, keeps the same band. Without it the
          // cover below, pulled up over the band, would end up above the
          // top of the page, where it can't be scrolled to.
          <div className="h-48 w-full overflow-hidden bg-card sm:h-64">
            {data.coverUrl && (
              <img
                src={data.coverUrl}
                alt=""
                className="size-full scale-125 object-cover opacity-40 blur-2xl"
              />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-canvas to-canvas/10" />
        <button
          type="button"
          onClick={() => void goBack()}
          className="absolute top-4 left-4 rounded-full bg-canvas/80 px-3 py-1 text-sm font-semibold"
        >
          {t('game.back')}
        </button>
      </div>

      <div className="-mt-16 flex flex-col gap-6 px-4">
        <div className="relative flex items-end gap-4">
          <GameCover
            title={data.title}
            coverUrl={data.coverUrl}
            heroUrl={null}
            className="w-28 shrink-0"
          />
          <div className="pb-1">
            <h1 className="font-display text-2xl leading-tight font-bold">
              {data.title}
            </h1>
            {data.developer && (
              <p className="text-sm text-muted">{data.developer}</p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-card p-3"
            >
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-display text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        <StoresLine game={data} />
        <RecommendedByLine game={data} />
        {!data.owned && data.status === 'WISHLIST' && (
          <RemoveFromWishlist id={data.id} />
        )}

        <YourCallSection game={data} />

        <LengthSection game={data} />

        <AchievementsSection game={data} />

        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-line px-3 py-1 text-sm text-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        {data.summary && (
          <p className="leading-relaxed text-fg/90">{data.summary}</p>
        )}

        {data.steamAppId !== null && (
          <a
            href={`https://store.steampowered.com/app/${data.steamAppId}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-cyan"
          >
            {t('game.steamStore')}
          </a>
        )}
      </div>
    </main>
  );
}

/**
 * Lengths from IGDB, or a way to fill them in: a link to search
 * HowLongToBeat by hand and a field to type the hours.
 */
function LengthSection({ game }: { game: LibraryGame }) {
  const { t, i18n } = useTranslation();
  const setLength = useSetLength(game.id);
  const { timeToBeat } = game;
  const [hours, setHours] = useState(
    timeToBeat.source === 'manual' && timeToBeat.extraMinutes
      ? String(timeToBeat.extraMinutes / 60)
      : '',
  );

  const lengths = [
    ['main', timeToBeat.mainMinutes],
    ['extra', timeToBeat.extraMinutes],
    ['complete', timeToBeat.completeMinutes],
  ] as const;
  const known = lengths.filter(([, minutes]) => minutes !== null);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(hours.replace(',', '.'));
    if (value > 0) {
      setLength.mutate(Math.round(value * 60));
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-semibold">
        {t('game.lengths')}
      </h2>

      {known.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 text-center">
          {known.map(([kind, minutes]) => (
            <li key={kind}>
              <p className="text-xs text-muted">
                {t(`game.lengthKind.${kind}`)}
              </p>
              <p className="font-semibold">
                {formatHours(minutes ?? 0, i18n.language)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t('game.noLength')}</p>
      )}

      {timeToBeat.source !== 'igdb' && (
        <>
          <a
            href={`https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-cyan"
          >
            {t('game.searchHltb')}
          </a>
          <form onSubmit={save} className="flex items-center gap-2">
            <label htmlFor="length-hours" className="text-sm text-muted">
              {t('game.yourLength')}
            </label>
            <input
              id="length-hours"
              inputMode="decimal"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className="w-20 rounded-lg border border-line bg-canvas px-2 py-1"
            />
            <button
              type="submit"
              disabled={setLength.isPending}
              className="rounded-lg bg-fg px-3 py-1 text-sm font-semibold text-canvas disabled:opacity-60"
            >
              {t('game.save')}
            </button>
            {timeToBeat.source === 'manual' && (
              <button
                type="button"
                onClick={() => {
                  setHours('');
                  setLength.mutate(null);
                }}
                className="text-sm text-muted underline"
              >
                {t('game.clearLength')}
              </button>
            )}
          </form>
        </>
      )}
    </section>
  );
}

/**
 * The player's own word: status, type and servers. Each has "automatic",
 * which shows what the app worked out and hands the decision back to it.
 */
function YourCallSection({ game }: { game: LibraryGame }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateLibraryGame(game.id);

  const server = game.serverStatus.override ?? game.serverStatus.catalog;
  const closedAt = game.serverStatus.closedAt;
  const closingNote =
    closedAt &&
    (server === 'ANNOUNCED' || server === 'PARTIAL' || server === 'CLOSED')
      ? t(
          // The status already says whether the day is ahead or behind.
          server === 'ANNOUNCED' ? 'game.closesOn' : 'game.closedOn',
          {
            date: new Intl.DateTimeFormat(i18n.language, {
              dateStyle: 'long',
            }).format(new Date(closedAt)),
          },
        )
      : null;
  const errorCode =
    update.error instanceof ApiRequestError && update.error.code
      ? update.error.code
      : update.error
        ? 'UNKNOWN'
        : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-semibold">
        {t('game.yourCall')}
      </h2>

      {game.owned && (
        <Picker
          id="game-status"
          label={t('game.statusLabel')}
          value={game.status}
          chosenByPlayer={game.statusSource === 'MANUAL'}
          options={OWNED_STATUSES.map((status) => [
            status,
            t(`status.${status}`),
          ])}
          disabled={update.isPending}
          onPick={(value) =>
            update.mutate({ status: value as (typeof OWNED_STATUSES)[number] })
          }
          onReset={() => update.mutate({ status: null })}
        />
      )}

      <Picker
        id="game-type"
        label={t('game.typeLabel')}
        value={game.gameType.override ?? game.gameType.catalog}
        chosenByPlayer={game.gameType.override !== null}
        options={PICKABLE_GAME_TYPES.map((type) => [
          type,
          t(`gameType.${type}`),
        ])}
        unknownLabel={t('gameType.UNKNOWN')}
        disabled={update.isPending}
        onPick={(value) =>
          update.mutate({
            gameType: value as (typeof PICKABLE_GAME_TYPES)[number],
          })
        }
        onReset={() => update.mutate({ gameType: null })}
      />

      <Picker
        id="game-servers"
        label={t('game.serversLabel')}
        value={server}
        chosenByPlayer={game.serverStatus.override !== null}
        options={PICKABLE_SERVER_STATUSES.map((status) => [
          status,
          t(`serverStatus.${status}`),
        ])}
        unknownLabel={t('serverStatus.UNKNOWN')}
        disabled={update.isPending}
        onPick={(value) =>
          update.mutate({
            serverStatus: value as (typeof PICKABLE_SERVER_STATUSES)[number],
          })
        }
        onReset={() => update.mutate({ serverStatus: null })}
      />
      {closingNote && (
        <p
          className={`text-sm ${server === 'CLOSED' ? 'text-danger' : 'text-muted'}`}
        >
          {closingNote}
        </p>
      )}

      {errorCode && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${errorCode}`)}
        </p>
      )}
    </section>
  );
}

/**
 * A labelled select showing the value itself ("On hold"), not who set it.
 * Below, in small print, where it comes from: the app, or the player with
 * a way to hand it back. Picking a value makes it the player's.
 */
function Picker({
  id,
  label,
  value,
  chosenByPlayer,
  options,
  unknownLabel,
  disabled,
  onPick,
  onReset,
}: {
  id: string;
  label: string;
  value: string;
  chosenByPlayer: boolean;
  options: ReadonlyArray<readonly [string, string]>;
  /** Shown, but not pickable, when the app doesn't know ("UNKNOWN"). */
  unknownLabel?: string;
  disabled: boolean;
  onPick: (value: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const known = options.some(([option]) => option === value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-muted">
          {label}
        </label>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onPick(event.target.value)}
          className="min-w-0 rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm disabled:opacity-60"
        >
          {!known && (
            <option value={value} disabled>
              {unknownLabel ?? value}
            </option>
          )}
          {options.map(([option, text]) => (
            <option key={option} value={option}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <p className="self-end text-xs text-muted">
        {chosenByPlayer ? (
          <>
            {t('game.chosenByYou')}
            {' · '}
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="text-cyan underline-offset-2 hover:underline"
            >
              {t('game.backToAutomatic')}
            </button>
          </>
        ) : (
          t('game.setByApp')
        )}
      </p>
    </div>
  );
}

/**
 * Where the game is owned, when it's more than plain Steam: an external
 * store ("Jack Sparrow") or several, each with its hours.
 */
function StoresLine({ game }: { game: LibraryGame }) {
  const { t, i18n } = useTranslation();
  const worthShowing =
    game.ownerships.length > 1 ||
    game.ownerships.some((ownership) => ownership.platform !== 'STEAM');
  if (!worthShowing) {
    return null;
  }
  const stores = game.ownerships.map((ownership) => {
    const name = ownership.sourceName ?? t(`platform.${ownership.platform}`);
    return ownership.playtimeMinutes > 0
      ? `${name} (${formatHours(ownership.playtimeMinutes, i18n.language)})`
      : name;
  });
  return (
    <p className="text-sm text-muted">
      {t('game.ownedIn', { stores: stores.join(' · ') })}
    </p>
  );
}

/** "Recommended by" with the label of each followed curator that does. */
function RecommendedByLine({ game }: { game: LibraryGame }) {
  const { t } = useTranslation();
  if (game.recommendedBy.length === 0) {
    return null;
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
      {t('game.recommendedBy')}
      {game.recommendedBy.map((curator) => (
        <CuratorLabel key={curator.name} curator={curator} />
      ))}
    </p>
  );
}

/** Out of "Lo quiero" for good: back to the wishlist afterwards. */
function RemoveFromWishlist({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useRemoveFromWishlist();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(id, {
            onSuccess: () =>
              navigate(
                `/library?${toSearchParams({ view: 'wishlist', sort: 'priority' })}`,
              ),
          })
        }
        className="self-start rounded-xl border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {t('game.removeFromWishlist')}
      </button>
      <p className="text-xs text-muted">{t('game.removeFromWishlistHint')}</p>
    </div>
  );
}
