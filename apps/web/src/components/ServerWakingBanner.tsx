import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** A request slower than this is most likely the API waking up. */
const WAKING_AFTER_MS = 3000;

/**
 * "Waking the server up…" while a request takes longer than usual. On
 * Render's free plan the API sleeps after 15 minutes idle and takes up to
 * a minute to start; meanwhile the app shows the data it saved last time.
 * Goes away by itself when the API answers.
 */
export function ServerWakingBanner() {
  const { t } = useTranslation();
  const busy = useIsFetching() + useIsMutating() > 0;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!busy) {
      return;
    }
    const timer = setTimeout(() => setSlow(true), WAKING_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  if (!busy || !slow) {
    return null;
  }
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
    >
      <p className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs shadow-lg">
        <span
          aria-hidden
          className="size-2 shrink-0 animate-pulse rounded-full bg-cyan"
        />
        {t('server.waking')}
      </p>
    </div>
  );
}
