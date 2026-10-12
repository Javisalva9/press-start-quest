import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { steamLoginUrl } from '../api/auth';
import { useSession } from '../auth/use-session';

export default function LoginPage() {
  const { t } = useTranslation();
  const session = useSession();

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-8 px-6 text-center">
      {/* Decorative: the app name is right below. */}
      <img
        src="/favicon.svg"
        alt=""
        width={112}
        height={112}
        className="size-28"
      />
      <div>
        <h1 className="font-pixel text-base leading-loose">{t('app.name')}</h1>
        <p className="mt-3 text-muted">{t('login.tagline')}</p>
      </div>
      {/* A plain link: signing in leaves the app for Steam's own page. */}
      <a
        href={steamLoginUrl()}
        className="w-full rounded-xl bg-linear-to-r from-violet to-cyan px-6 py-4 font-display text-lg font-semibold text-white shadow-lg shadow-violet/20 transition active:scale-[0.98]"
      >
        {t('login.withSteam')}
      </a>
      <p className="text-sm text-muted">{t('login.privacy')}</p>
    </main>
  );
}
