import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { signOut } from '../api/auth';
import { useMe } from '../api/me';
import { SteamPrivacyNotice } from '../components/SteamPrivacyNotice';

/** Placeholder home: it becomes the progress screen in stage 2. */
export default function HomePage() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const lastSyncAt = me.data?.lastSyncAt;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
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

      <section className="rounded-2xl border border-line bg-card p-6">
        <h1 className="font-display text-2xl font-bold">
          {me.data
            ? t('home.greeting', { name: me.data.displayName })
            : t('home.loading')}
        </h1>
        <p className="mt-2 text-muted">{t('home.comingSoon')}</p>
      </section>

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
