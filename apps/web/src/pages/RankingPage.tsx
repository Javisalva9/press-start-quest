import type { Mood, RecommendationFactors } from '@psq/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRecommendationRanking } from '../api/recommendations';
import { formatHours } from '../format';
import { MoodPicker } from '../components/MoodPicker';
import { ReasonsLine } from '../components/ReasonsLine';

const FACTORS: Array<keyof RecommendationFactors> = [
  'quality',
  'affinity',
  'length',
  'social',
  'momentum',
];

/**
 * The recommendation ranking with every factor: a tool to tune the
 * formula's weights, out of the everyday path (the card is that).
 */
export default function RankingPage() {
  const { t, i18n } = useTranslation();
  const [mood, setMood] = useState<Mood | null>(null);
  const ranking = useRecommendationRanking(mood);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-5 pt-8 pb-24">
      <Link to="/" className="text-sm text-muted hover:text-fg">
        {t('ranking.back')}
      </Link>
      <h1 className="font-display text-2xl font-bold">{t('ranking.title')}</h1>
      <p className="text-sm text-muted">{t('ranking.intro')}</p>
      <Link to="/settings" className="text-sm font-semibold text-cyan">
        {t('ranking.tune')}
      </Link>

      <MoodPicker mood={mood} onChange={setMood} />

      {ranking.isPending ? (
        <div aria-busy className="h-64 animate-pulse rounded-2xl bg-card" />
      ) : ranking.isError ? (
        <p className="text-sm text-muted">{t('next.error')}</p>
      ) : ranking.data.items.length === 0 ? (
        <p className="text-sm text-muted">
          {t(mood ? 'next.emptyMood' : 'next.empty')}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {t('ranking.candidates', { count: ranking.data.candidates })}
          </p>
          <ol className="flex flex-col gap-3">
            {ranking.data.items.map((game, index) => (
              <li
                key={game.id}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to={`/library/${game.id}`}
                    className="min-w-0 truncate font-semibold"
                  >
                    {t('ranking.position', {
                      position: index + 1,
                      title: game.title,
                    })}
                  </Link>
                  <span className="shrink-0 font-display text-lg font-bold text-cyan">
                    {game.score.toFixed(2)}
                  </span>
                </div>
                <dl className="grid grid-cols-5 gap-1 text-center">
                  {FACTORS.map((factor) => (
                    <div
                      key={factor}
                      className="rounded-lg bg-canvas px-1 py-1.5"
                    >
                      <dt className="truncate text-[0.65rem] text-muted">
                        {t(`ranking.factor.${factor}`)}
                      </dt>
                      <dd className="font-display text-sm font-semibold">
                        {game.factors[factor].toFixed(2)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted">
                  <ReasonsLine reasons={game.reasons} />
                  {game.remainingMinutes !== null &&
                    !game.reasons.some(
                      (reason) => reason.code === 'TIME_LEFT',
                    ) && (
                      <span>
                        {t('next.reason.TIME_LEFT', {
                          hours: formatHours(
                            game.remainingMinutes,
                            i18n.language,
                          ),
                        })}
                      </span>
                    )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
