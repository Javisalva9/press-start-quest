import { useTranslation } from 'react-i18next';
import { signOut } from '../api/auth';
import { useMe } from '../api/me';

/** Placeholder home: it becomes the progress screen in stage 2. */
export default function HomePage() {
  const { t } = useTranslation();
  const me = useMe();

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

      <section className="rounded-2xl border border-line bg-card p-6">
        <h1 className="font-display text-2xl font-bold">
          {me.data
            ? t('home.greeting', { name: me.data.displayName })
            : t('home.loading')}
        </h1>
        <p className="mt-2 text-muted">{t('home.comingSoon')}</p>
      </section>
    </main>
  );
}
