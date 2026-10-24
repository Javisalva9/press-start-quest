import type { Milestone } from '@psq/shared';
import { useTranslation } from 'react-i18next';
import { useStatsMilestones } from '../api/stats';
import { monthLabel } from '../progress';

/** Badges shown before "and N more": the newest are the ones that matter. */
const SHOWN_BADGES = 6;

/**
 * "Your milestones": what's next of each kind with how far you are, and
 * the badges already earned. Small goals within reach, not a long list.
 */
export function MilestonesCard() {
  const { t } = useTranslation();
  const milestones = useStatsMilestones();

  if (milestones.isPending) {
    return (
      <section
        aria-busy
        className="h-48 animate-pulse rounded-2xl border border-line bg-card"
      />
    );
  }
  if (milestones.isError) {
    return null;
  }
  const { reached, next } = milestones.data;
  const hidden = reached.length - SHOWN_BADGES;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">
        {t('milestones.title')}
      </h2>

      <ul className="flex flex-col gap-3">
        {next.map((milestone) => (
          <li key={milestone.kind}>
            <NextMilestone milestone={milestone} />
          </li>
        ))}
      </ul>

      {reached.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t('milestones.reached')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {reached.slice(0, SHOWN_BADGES).map((milestone) => (
              <li key={`${milestone.kind}-${milestone.target}`}>
                <Badge milestone={milestone} />
              </li>
            ))}
            {hidden > 0 && (
              <li className="self-center text-xs text-muted">
                {t('milestones.more', { count: hidden })}
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

function NextMilestone({ milestone }: { milestone: Milestone }) {
  const { t } = useTranslation();
  const share = Math.min(1, milestone.current / milestone.target);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          {t(`milestones.next.${milestone.kind}`, { count: milestone.target })}
        </span>
        <span className="shrink-0 text-muted tabular-nums">
          {t('milestones.progress', {
            current: milestone.current,
            target: milestone.target,
          })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={milestone.target}
        aria-valuenow={milestone.current}
        className="h-1.5 overflow-hidden rounded-full bg-canvas"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-violet to-cyan"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

/** An earned milestone in the pixel font, the plan's badge style. */
function Badge({ milestone }: { milestone: Milestone }) {
  const { t, i18n } = useTranslation();
  const month = milestone.reachedOn
    ? monthLabel(milestone.reachedOn.slice(0, 7), i18n.language)
    : '';
  const date = milestone.reachedOn
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${milestone.reachedOn}T00:00:00Z`))
    : '';
  const name = t(`milestones.name.${milestone.kind}`, {
    count: milestone.target,
    month,
  });
  return (
    <span
      title={t('milestones.reachedOn', { name, date })}
      className="inline-flex flex-col items-center gap-1 rounded-lg border border-star/40 bg-canvas px-2.5 py-2"
    >
      <span className="font-pixel text-[0.6rem] leading-none text-star">
        {t(`milestones.badge.${milestone.kind}`, {
          count: milestone.target,
          month,
        })}
      </span>
      <span className="text-[0.65rem] leading-none text-muted">{name}</span>
    </span>
  );
}
