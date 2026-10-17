import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { signOut } from '../api/auth';
import { useMe } from '../api/me';
import { useReviewQueue } from '../api/review';
import { useStatsOverview } from '../api/stats';
import { ProgressCard } from '../components/ProgressCard';
import { SteamPrivacyNotice } from '../components/SteamPrivacyNotice';

/** Home: "how far have I got", what's waiting to review, and the sync. */
export default function HomePage() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const stats = useStatsOverview();
  // Only the count is needed: one card is enough to get the total.
  const review = useReviewQueue(1);
  const toReview = review.data?.total ?? 0;
  const lastSyncAt = me.data?.lastSyncAt;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pt-8 pb-24">
      <header className="flex items-center justify-between">
        <img
          src="/favicon.svg"
          alt=""
          width={40}
          height={40}
          className="size-10"
        />
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-muted transition hover:text-fg"
        >
          {t('home.signOut')}
        </button>
      </header>

      <SteamPrivacyNotice />

      <h1 className="font-display text-2xl font-bold">
        {me.data
          ? t('home.greeting', { name: me.data.displayName })
          : t('home.loading')}
      </h1>

      {stats.data ? (
        <ProgressCard stats={stats.data} />
      ) : (
        // A skeleton while it loads (or the API wakes up), not a blank.
        <section
          aria-busy
          className="h-72 animate-pulse rounded-2xl border border-line bg-card"
        />
      )}

      {toReview > 0 && (
        <section className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5">
          <p className="font-semibold">
            {t('home.review', { count: toReview })}
          </p>
          <Link
            to="/review"
            className="shrink-0 rounded-xl bg-linear-to-r from-violet to-cyan px-4 py-2 font-semibold text-canvas"
          >
            {t('home.reviewNow')}
          </Link>
        </section>
      )}

      <section className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-muted">
          {lastSyncAt
            ? t('home.lastSync', {
                date: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(lastSyncAt)),
              })
            : t('home.neverSynced')}
        </p>
        <Link to="/sync" className="shrink-0 font-semibold text-cyan">
          {t('home.syncNow')}
        </Link>
      </section>
    </main>
  );
}
