import type { GameAchievement, LibraryGame } from '@psq/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../api/client';
import { useFinaleVote, useGameAchievements } from '../api/achievements';
import { finaleAction, finaleSourceKey } from '../finale';

const FINALE_ICON = '🏁';

/**
 * The game's achievements, folded until opened (some games have hundreds),
 * where the player says which one marks the ending: for hidden ones the
 * rules can't see, or to correct them.
 */
export function AchievementsSection({ game }: { game: LibraryGame }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const achievements = useGameAchievements(game.id, open);
  const vote = useFinaleVote(game.id);

  if (!game.achievements || game.achievements.total === 0) {
    return null;
  }
  const shown =
    achievements.data?.filter(
      (achievement) => showLocked || achievement.unlockedAt,
    ) ?? [];
  const errorCode =
    vote.error instanceof ApiRequestError && vote.error.code
      ? vote.error.code
      : vote.error
        ? 'UNKNOWN'
        : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        // The focus ring only when moving with the keyboard, not after a
        // click or a tap.
        className="flex items-center justify-between rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <h2 className="font-display text-lg font-semibold">
          {t('achievements.title', {
            unlocked: game.achievements.unlocked,
            total: game.achievements.total,
          })}
        </h2>
        <span className="text-sm text-cyan">
          {open ? t('achievements.hide') : t('achievements.show')}
        </span>
      </button>

      {open && (
        <>
          <p className="text-sm text-muted">{t('achievements.hint')}</p>
          {achievements.isPending && (
            <p className="text-sm text-muted">{t('home.loading')}</p>
          )}
          {errorCode && (
            <p role="alert" className="text-sm text-danger">
              {t(`errors.${errorCode}`)}
            </p>
          )}
          <ul className="flex flex-col divide-y divide-line">
            {shown.map((achievement) => (
              <AchievementRow
                key={achievement.id}
                achievement={achievement}
                disabled={vote.isPending}
                onVote={(value) =>
                  vote.mutate({ achievementId: achievement.id, vote: value })
                }
              />
            ))}
          </ul>
          {achievements.data && (
            <button
              type="button"
              onClick={() => setShowLocked(!showLocked)}
              className="self-start text-sm font-semibold text-cyan"
            >
              {showLocked
                ? t('achievements.onlyUnlocked')
                : t('achievements.withLocked')}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function AchievementRow({
  achievement,
  disabled,
  onVote,
}: {
  achievement: GameAchievement;
  disabled: boolean;
  onVote: (vote: boolean | null) => void;
}) {
  const { t } = useTranslation();
  const action = finaleAction(achievement.finale);
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p
          className={`font-semibold ${achievement.unlockedAt ? '' : 'text-muted'}`}
        >
          {achievement.name}
        </p>
        <p className="text-sm text-muted">
          {achievement.description || t('achievements.hidden')}
        </p>
        {achievement.finale.isFinale && (
          <p className="mt-1 text-xs font-semibold text-success">
            <span aria-hidden className="mr-1">
              {FINALE_ICON}
            </span>
            {t('achievements.finale')}
            {' · '}
            {t(finaleSourceKey(achievement.finale.source))}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote(action.vote)}
        className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {t(action.key)}
      </button>
    </li>
  );
}
