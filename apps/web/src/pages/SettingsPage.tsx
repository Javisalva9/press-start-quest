import {
  DEFAULT_WEIGHTS,
  LANGUAGES,
  MAX_WEIGHT,
  RECOMMENDATION_FACTORS,
  weightShares,
  type Language,
  type RecommendationWeights,
} from '@psq/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { signOut } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { useMe, useUpdateMe } from '../api/me';

/** Settings: the app's language and how the next game is picked. */
export default function SettingsPage() {
  const { t } = useTranslation();
  const me = useMe();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pt-8 pb-24">
      <h1 className="font-display text-2xl font-bold">{t('settings.title')}</h1>

      {me.data ? (
        <>
          <LanguageSection locale={me.data.locale} />
          <WeightsSection saved={me.data.settings.weights} />
        </>
      ) : (
        <section
          aria-busy
          className="h-96 animate-pulse rounded-2xl border border-line bg-card"
        />
      )}

      <button
        type="button"
        onClick={() => void signOut()}
        className="self-start text-sm text-muted transition hover:text-fg"
      >
        {t('home.signOut')}
      </button>
    </main>
  );
}

function LanguageSection({ locale }: { locale: Language }) {
  const { t } = useTranslation();
  const update = useUpdateMe();
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">
        {t('settings.language')}
      </h2>
      <div
        role="group"
        aria-label={t('settings.language')}
        className="flex gap-2"
      >
        {LANGUAGES.map((language) => {
          const active = language === locale;
          return (
            <button
              key={language}
              type="button"
              aria-pressed={active}
              disabled={update.isPending}
              onClick={() => !active && update.mutate({ locale: language })}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
                active
                  ? 'border-cyan bg-cyan/15 text-fg'
                  : 'border-line text-muted hover:text-fg'
              }`}
            >
              {/* Each language in its own words: findable whatever is on. */}
              {t(`settings.languageName.${language}`)}
            </button>
          );
        })}
      </div>
      <ErrorLine error={update.error} />
    </section>
  );
}

const sameWeights = (a: RecommendationWeights, b: RecommendationWeights) =>
  RECOMMENDATION_FACTORS.every((factor) => a[factor] === b[factor]);

/**
 * The formula's weights as sliders, with each factor's share of the total
 * next to it: what the slider does is easier to read as "40 %".
 */
function WeightsSection({ saved }: { saved: RecommendationWeights }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateMe();
  // Starts from what's saved; after saving, both are the same again.
  const [draft, setDraft] = useState(saved);
  const shares = weightShares(draft);
  const percent = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  const nothingCounts = RECOMMENDATION_FACTORS.every(
    (factor) => draft[factor] === 0,
  );
  const changed = !sameWeights(draft, saved);
  const isDefault = sameWeights(draft, DEFAULT_WEIGHTS);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">
          {t('settings.weights.title')}
        </h2>
        <p className="text-sm text-muted">{t('settings.weights.intro')}</p>
      </div>

      <ul className="flex flex-col gap-4">
        {RECOMMENDATION_FACTORS.map((factor) => (
          <li key={factor} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`weight-${factor}`} className="font-semibold">
                {t(`ranking.factor.${factor}`)}
              </label>
              <span className="font-display text-sm font-semibold text-cyan tabular-nums">
                {percent.format(shares[factor])}
              </span>
            </div>
            <input
              id={`weight-${factor}`}
              type="range"
              min={0}
              max={MAX_WEIGHT}
              step={1}
              value={draft[factor]}
              onChange={(event) =>
                setDraft({ ...draft, [factor]: Number(event.target.value) })
              }
              className="w-full accent-cyan"
            />
            <p className="text-xs text-muted">
              {t(`settings.weights.hint.${factor}`)}
            </p>
          </li>
        ))}
      </ul>

      {nothingCounts && (
        <p role="alert" className="text-sm text-danger">
          {t('settings.weights.nothingCounts')}
        </p>
      )}
      {update.isSuccess && !changed && (
        <p role="status" className="text-sm text-success">
          {t('settings.weights.saved')}
        </p>
      )}
      <ErrorLine error={update.error} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!changed || nothingCounts || update.isPending}
          onClick={() =>
            // The plan's weights are saved as "none of mine": a future
            // change of the defaults reaches this player too.
            update.mutate({ weights: isDefault ? null : draft })
          }
          className="rounded-xl bg-linear-to-r from-violet to-cyan px-4 py-2 font-semibold text-canvas disabled:opacity-50"
        >
          {t('settings.weights.save')}
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_WEIGHTS)}
            disabled={update.isPending}
            className="text-sm font-semibold text-muted transition hover:text-fg disabled:opacity-50"
          >
            {t('settings.weights.restore')}
          </button>
        )}
      </div>

      <Link to="/recommendations" className="text-sm font-semibold text-cyan">
        {t('settings.weights.ranking')}
      </Link>
    </section>
  );
}

function ErrorLine({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  if (!error) {
    return null;
  }
  const code =
    error instanceof ApiRequestError && error.code ? error.code : 'UNKNOWN';
  return (
    <p role="alert" className="text-sm text-danger">
      {t(`errors.${code}`)}
    </p>
  );
}
