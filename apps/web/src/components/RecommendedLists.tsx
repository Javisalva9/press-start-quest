import type { CuratorSummary } from '@psq/shared';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../api/client';
import { useCurators, useFollowCurator } from '../api/curators';

/**
 * "Recommended lists" on top of "Lo quiero": each curator with what
 * following it would mean for this player, and the button to do it.
 */
export function RecommendedLists() {
  const { t } = useTranslation();
  const curators = useCurators();
  if (!curators.data?.length) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">
        {t('curators.title')}
      </h2>
      {curators.data.map((curator) => (
        <CuratorCard key={curator.id} curator={curator} />
      ))}
    </section>
  );
}

function CuratorCard({ curator }: { curator: CuratorSummary }) {
  const { t } = useTranslation();
  const follow = useFollowCurator();
  const notOwned = curator.games - curator.owned;
  const errorCode =
    follow.error instanceof ApiRequestError && follow.error.code
      ? follow.error.code
      : follow.error
        ? 'UNKNOWN'
        : null;

  const toggle = () => {
    // Unfollowing removes games from "Lo quiero": said before it happens.
    if (curator.following && !window.confirm(t('curators.unfollowConfirm'))) {
      return;
    }
    follow.mutate({ id: curator.id, follow: !curator.following });
  };

  return (
    <article
      className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4"
      style={{ borderColor: curator.color ?? undefined }}
    >
      <div className="min-w-0">
        <p className="font-display font-semibold">
          {curator.name}
          <span className="ml-2 text-sm font-normal text-muted">
            {t('curators.games', { count: curator.games })}
          </span>
        </p>
        <p className="text-sm text-muted">
          {curator.following
            ? t('curators.following')
            : t('curators.preview', { count: notOwned, owned: curator.owned })}
        </p>
        {errorCode && (
          <p role="alert" className="text-sm text-danger">
            {t(`errors.${errorCode}`)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={follow.isPending}
        className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
          curator.following
            ? 'border border-line text-fg'
            : 'bg-linear-to-r from-violet to-cyan text-canvas'
        }`}
      >
        {curator.following ? t('curators.unfollow') : t('curators.follow')}
      </button>
    </article>
  );
}
