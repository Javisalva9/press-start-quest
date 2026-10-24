import type { TimelineMonth } from '@psq/shared';
import { useTranslation } from 'react-i18next';
import { useStatsTimeline } from '../api/stats';
import { formatHours } from '../format';
import { monthLabel } from '../progress';

/**
 * "Your months": hours played per month as bars, with the games completed
 * on top. Plain bars, no chart library: a dozen columns don't need one.
 */
export function TimelineCard() {
  const { t } = useTranslation();
  const timeline = useStatsTimeline();
  const months = timeline.data?.months ?? [];
  const nothing = months.every(
    (month) => month.playedMinutes === 0 && month.completed === 0,
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">
        {t('home.timeline.title')}
      </h2>
      {timeline.isPending ? (
        <div aria-busy className="h-40 animate-pulse rounded-xl bg-canvas" />
      ) : timeline.isError ? (
        <p className="text-sm text-muted">{t('home.timeline.error')}</p>
      ) : nothing ? (
        <p className="text-sm text-muted">{t('home.timeline.empty')}</p>
      ) : (
        <>
          <Bars months={months} />
          <p className="text-xs text-muted">{t('home.timeline.legend')}</p>
        </>
      )}
    </section>
  );
}

function Bars({ months }: { months: TimelineMonth[] }) {
  const { t, i18n } = useTranslation();
  const most = Math.max(1, ...months.map((month) => month.playedMinutes));
  return (
    <ol className="flex h-40 items-end gap-1.5">
      {months.map((month) => {
        const hours = formatHours(month.playedMinutes, i18n.language);
        const label = monthLabel(month.month, i18n.language);
        return (
          <li
            key={month.month}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            aria-label={t('home.timeline.month', {
              month: label,
              hours,
              count: month.completed,
            })}
          >
            {month.completed > 0 && (
              <span className="font-display text-xs font-bold text-success">
                {t('home.timeline.completed', { count: month.completed })}
              </span>
            )}
            <div
              className="w-full rounded-t-md bg-linear-to-t from-violet to-cyan"
              // At least a sliver: a month with a little play shows.
              style={{
                height: `${Math.max(month.playedMinutes > 0 ? 3 : 0, (month.playedMinutes / most) * 100)}%`,
              }}
              title={hours}
            />
            <span className="truncate text-[0.65rem] text-muted">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
