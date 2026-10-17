import type { StatsOverview } from '@psq/shared';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatHours } from '../format';
import { ringPercent } from '../progress';

const RADIUS = 52;
const LENGTH = 2 * Math.PI * RADIUS;

/** "How far have I got": the ring, the counts and the streak. */
export function ProgressCard({ stats }: { stats: StatsOverview }) {
  const { t, i18n } = useTranslation();
  const percent = ringPercent(stats.completed, stats.pending);
  const inRing = stats.completed + stats.pending;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">
        {t('home.progress.title')}
      </h2>

      {inRing === 0 ? (
        <p className="text-muted">{t('home.progress.empty')}</p>
      ) : (
        <div className="flex items-center gap-5">
          <Ring percent={percent} />
          <div className="flex flex-col gap-1">
            <p className="font-display text-2xl font-bold">
              {t('home.progress.completedOf', {
                completed: stats.completed,
                total: inRing,
              })}
            </p>
            <p className="text-sm text-muted">
              {t('home.progress.pending', { count: stats.pending })}
            </p>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <Counter
          label={t('home.progress.remaining')}
          value={formatHours(stats.remainingMinutes, i18n.language)}
          note={
            stats.pendingWithoutLength > 0
              ? t('home.progress.withoutLength', {
                  count: stats.pendingWithoutLength,
                })
              : undefined
          }
        />
        <Counter
          label={t('home.progress.streak')}
          value={t('home.progress.days', { count: stats.streak.current })}
          note={
            stats.streak.best > 0
              ? t('home.progress.bestStreak', { count: stats.streak.best })
              : undefined
          }
        />
        <Counter
          label={t('home.progress.endless')}
          value={String(stats.endless)}
        />
        <Counter
          label={t('home.progress.abandoned')}
          value={String(stats.abandoned)}
        />
        {stats.closed > 0 && (
          <Counter
            label={t('home.progress.closed')}
            value={String(stats.closed)}
            danger
          />
        )}
      </dl>

      <p className="text-xs text-muted">
        {stats.streak.since
          ? t('home.progress.since', {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: 'long',
                timeZone: 'UTC',
              }).format(new Date(`${stats.streak.since}T00:00:00Z`)),
            })
          : t('home.progress.noHistory')}
      </p>
    </section>
  );
}

/** The completed share as a ring, with the plan's violet-to-cyan gradient. */
function Ring({ percent }: { percent: number }) {
  const { t } = useTranslation();
  const offset = LENGTH * (1 - percent / 100);
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-violet)" />
            <stop offset="100%" stopColor="var(--color-cyan)" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={offset}
          className="ring-fill"
          style={{ '--ring-length': LENGTH } as CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold">
        {t('home.progress.percent', { percent })}
      </span>
    </div>
  );
}

function Counter({
  label,
  value,
  note,
  danger = false,
}: {
  label: string;
  value: string;
  note?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`font-display text-xl font-bold ${danger ? 'text-danger' : ''}`}
      >
        {value}
      </dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}
