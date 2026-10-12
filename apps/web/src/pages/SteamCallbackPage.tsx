import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { DEFAULT_LANGUAGE, LanguageSchema, type ErrorCode } from '@psq/shared';
import { signInWithSteam } from '../api/auth';
import { ApiRequestError } from '../api/client';

/**
 * Steam's answer can only be checked once. React runs effects twice in
 * development (StrictMode), so each answer is remembered here.
 */
const handledQueries = new Set<string>();

/** Steam sends the user back here; this page finishes the sign-in. */
export default function SteamCallbackPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<ErrorCode | 'UNKNOWN' | null>(null);

  useEffect(() => {
    const query = window.location.search;
    if (handledQueries.has(query)) {
      return;
    }
    handledQueries.add(query);

    const language = LanguageSchema.catch(DEFAULT_LANGUAGE).parse(
      i18n.language,
    );
    signInWithSteam(query, language)
      // replace: the URL with Steam's answer doesn't stay in the history.
      .then(() => navigate('/', { replace: true }))
      .catch((caught: unknown) =>
        setError(
          caught instanceof ApiRequestError && caught.code
            ? caught.code
            : 'UNKNOWN',
        ),
      );
  }, [i18n, navigate]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <img
        src="/favicon.svg"
        alt=""
        width={80}
        height={80}
        className="size-20"
      />
      {error ? (
        <>
          <p role="alert" className="text-danger">
            {t(`errors.${error}`)}
          </p>
          <Link
            to="/login"
            replace
            className="font-semibold text-cyan underline"
          >
            {t('callback.tryAgain')}
          </Link>
        </>
      ) : (
        <p aria-live="polite" className="text-muted">
          {t('callback.signingIn')}
        </p>
      )}
    </main>
  );
}
