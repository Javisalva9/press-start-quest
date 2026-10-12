import { useTranslation } from 'react-i18next';
import { useSteamPrivacy } from '../api/sources';

/** Steam's own privacy settings page for the signed-in Steam account. */
const STEAM_PRIVACY_SETTINGS_URL =
  'https://steamcommunity.com/my/edit/settings';

/**
 * Explains how to make the Steam profile readable when it isn't.
 * Shows nothing while loading, when everything is fine or if the check fails.
 */
export function SteamPrivacyNotice() {
  const { t } = useTranslation();
  const privacy = useSteamPrivacy();

  if (!privacy.data || privacy.data.status === 'PUBLIC') {
    return null;
  }
  const { status } = privacy.data;

  return (
    <section
      role="alert"
      className="rounded-2xl border border-danger/40 bg-danger/10 p-5"
    >
      <h2 className="font-display text-lg font-semibold">
        {t(`steamPrivacy.${status}.title`)}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {t(`steamPrivacy.${status}.body`)}
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>{t('steamPrivacy.steps.open')}</li>
        <li>{t('steamPrivacy.steps.public')}</li>
        <li>{t('steamPrivacy.steps.playtime')}</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={STEAM_PRIVACY_SETTINGS_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-canvas"
        >
          {t('steamPrivacy.openSettings')}
        </a>
        <button
          type="button"
          onClick={() => void privacy.refetch()}
          disabled={privacy.isFetching}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {privacy.isFetching
            ? t('steamPrivacy.checking')
            : t('steamPrivacy.checkAgain')}
        </button>
      </div>
    </section>
  );
}
