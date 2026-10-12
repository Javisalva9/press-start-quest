import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useMe } from '../api/me';
import { useStartSync, useSyncJob } from '../api/sync';
import { syncPhase } from '../sync-phase';

/**
 * Imports the Steam library and shows its progress. It's the first screen
 * after signing up, and where "Sync now" leads afterwards.
 */
export default function SyncPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const start = useStartSync();
  const job = useSyncJob(start.data?.id);

  // Started once when the page opens. The ref survives React's double run of
  // effects in development; and if a sync is already running, the API
  // returns that one instead of starting another.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      start.mutate();
    }
  }, [start]);

  const current = job.data ?? start.data;
  const phase = current ? syncPhase(current) : 'queued';
  const progress = current?.progress ?? 0;

  // Done: profile (lastSyncAt) and library are out of date now.
  useEffect(() => {
    if (phase === 'done') {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    }
  }, [phase, queryClient]);

  const firstTime = me.data?.lastSyncAt === null;
  const errorCode =
    current?.error ??
    (start.error instanceof ApiRequestError ? start.error.code : null) ??
    (start.isError ? 'UNKNOWN' : null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <img
        src="/favicon.svg"
        alt=""
        width={80}
        height={80}
        className="size-20"
      />
      <h1 className="font-display text-2xl font-bold">
        {firstTime ? t('sync.titleFirst') : t('sync.title')}
      </h1>

      {errorCode || phase === 'failed' ? (
        <>
          <p role="alert" className="text-danger">
            {t(`errors.${errorCode ?? 'SYNC_FAILED'}`)}
          </p>
          <button
            type="button"
            onClick={() => start.mutate()}
            className="rounded-xl border border-line px-5 py-3 font-semibold"
          >
            {t('sync.retry')}
          </button>
        </>
      ) : phase === 'done' && current?.stats ? (
        <>
          <ul className="space-y-1 text-muted">
            <li>
              {t('sync.games', {
                count: current.stats.gamesFound - current.stats.notGames,
              })}
            </li>
            <li>
              {t('sync.wishlist', { count: current.stats.wishlistItems })}
            </li>
          </ul>
          <Link
            to="/"
            className="w-full rounded-xl bg-linear-to-r from-violet to-cyan px-6 py-4 font-display text-lg font-semibold text-white"
          >
            {t('sync.continue')}
          </Link>
        </>
      ) : (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={t(`sync.phase.${phase}`)}
            className="h-3 w-full overflow-hidden rounded-full bg-card"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-violet to-cyan transition-[width] duration-500"
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
          <p aria-live="polite" className="font-semibold">
            {t(`sync.phase.${phase}`)} {t('sync.percent', { progress })}
          </p>
          {firstTime && (
            <p className="text-sm text-muted">{t('sync.firstTimeHint')}</p>
          )}
        </>
      )}
    </main>
  );
}
