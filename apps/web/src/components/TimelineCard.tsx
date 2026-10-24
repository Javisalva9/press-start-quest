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
    <ol className="flex gap-1.5">
      {months.map((month) => {
        const hours = formatHours(month.playedMinutes, i18n.language);
        const label = monthLabel(month.month, i18n.language);
        const height = (month.playedMinutes / most) * 100;
        return (
          <li
            key={month.month}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            aria-label={t('home.timeline.month', {
              month: label,
              hours,
              count: month.completed,
            })}
          >
            <span className="h-4 font-display text-[0.7rem] leading-4 font-bold whitespace-nowrap text-success">
              {month.completed > 0 &&
                t('home.timeline.completed', { count: month.completed })}
            </span>
            {/* Every month has its slot, so an empty one reads as empty, not missing. */}
            <div className="flex h-28 w-full items-end overflow-hidden rounded-md bg-canvas">
              <div
                className="w-full rounded-t-md bg-linear-to-t from-violet to-cyan"
                // At least a sliver: a month with a little play shows.
                style={{
                  height: `${month.playedMinutes > 0 ? Math.max(4, height) : 0}%`,
                }}
              />
            </div>
            <span className="truncate text-[0.65rem] text-muted">{label}</span>
            <span className="truncate text-[0.6rem] text-fg/80 tabular-nums">
              {month.playedMinutes > 0 ? hours : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
