import type {
  Mood,
  Recommendation,
  RecommendationFeedbackAction,
} from '@psq/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useUpdateLibraryGame } from '../api/library';
import {
  useNextRecommendation,
  useRecommendationFeedback,
} from '../api/recommendations';
import { steamRunUrl } from '../recommendation';
import { GameCover } from './GameCover';
import { MoodPicker } from './MoodPicker';
import { ReasonsLine } from './ReasonsLine';

/** A mouse means a computer, where Steam can start the game. */
const hasMouse = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: fine)').matches === true;

/** What the last answer did, shown on top of the next pick. */
interface Answered {
  id: string;
  title: string;
  /** With "not now": when it comes back. */
  snoozedUntil: string | null;
}

/**
 * "Your next game": one clear pick so there's nothing to decide, and two of
 * other genres below, small, as a plan B rather than a menu.
 */
export function NextGameCard() {
  const { t } = useTranslation();
  const [mood, setMood] = useState<Mood | null>(null);
  const [skip, setSkip] = useState(0);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const next = useNextRecommendation(mood, skip);
  const feedback = useRecommendationFeedback();

  const changeMood = (value: Mood | null) => {
    setMood(value);
    setSkip(0);
    setAnswered(null);
    feedback.reset();
  };

  // The list shrinks by the game answered, so the same skip already
  // points to the one after it.
  const answer = (
    game: Recommendation,
    action: RecommendationFeedbackAction,
  ) => {
    setAnswered(null);
    feedback.mutate(
      { id: game.id, action, mood },
      {
        onSuccess: ({ snoozedUntil }) =>
          setAnswered({ id: game.id, title: game.title, snoozedUntil }),
      },
    );
  };
  const feedbackError =
    feedback.error instanceof ApiRequestError && feedback.error.code
      ? feedback.error.code
      : feedback.error
        ? 'UNKNOWN'
        : null;

  return (
    // The plan's accent: the gradient frames this card only.
    <section className="rounded-2xl bg-linear-to-br from-violet to-cyan p-px">
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            {t('next.title')}
          </h2>
          <Link
            to="/recommendations"
            className="text-xs text-muted hover:text-fg"
          >
            {t('next.ranking')}
          </Link>
        </div>

        <MoodPicker mood={mood} onChange={changeMood} />

        {answered && (
          <AnsweredNotice
            answered={answered}
            onUndone={() => setAnswered(null)}
          />
        )}
        {feedbackError && (
          <p role="alert" className="text-sm text-danger">
            {t(`errors.${feedbackError}`)}
          </p>
        )}

        {next.isPending ? (
          <div aria-busy className="h-64 animate-pulse rounded-xl bg-canvas" />
        ) : next.isError ? (
          <p className="text-sm text-muted">{t('next.error')}</p>
        ) : next.data.pick ? (
          <>
            <Pick
              game={next.data.pick}
              busy={next.isPlaceholderData || feedback.isPending}
              canSkip={next.data.candidates > 1}
              onSkip={() => setSkip((value) => value + 1)}
              onAnswer={answer}
            />
            {next.data.alternatives.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {t('next.alternatives')}
                </h3>
                <ul className="flex flex-col gap-2">
                  {next.data.alternatives.map((game) => (
                    <li key={game.id}>
                      <Alternative game={game} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            {t(mood ? 'next.emptyMood' : 'next.empty')}
          </p>
        )}
      </div>
    </section>
  );
}

function Pick({
  game,
  busy,
  canSkip,
  onSkip,
  onAnswer,
}: {
  game: Recommendation;
  busy: boolean;
  canSkip: boolean;
  onSkip: () => void;
  onAnswer: (
    game: Recommendation,
    action: RecommendationFeedbackAction,
  ) => void;
}) {
  const { t } = useTranslation();
  const image = game.heroUrl ?? game.coverUrl;
  const play = steamRunUrl(game.steamAppId, hasMouse());
  return (
    <div
      className={`flex flex-col gap-3 transition ${busy ? 'opacity-60' : ''}`}
    >
      <Link
        to={`/library/${game.id}`}
        className="relative block aspect-[460/215] overflow-hidden rounded-xl bg-canvas"
      >
        {image && (
          <img
            src={image}
            alt=""
            className={`size-full object-cover ${game.heroUrl ? '' : 'scale-125 opacity-50 blur-xl'}`}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-canvas via-canvas/30 to-transparent" />
        <p className="absolute right-3 bottom-2 left-3 font-display text-xl leading-tight font-bold">
          {game.title}
        </p>
      </Link>

      <ReasonsLine reasons={game.reasons} className="text-sm text-fg/90" />

      <div className="flex gap-2">
        {play ? (
          <a
            href={play}
            className="flex-1 rounded-xl bg-linear-to-r from-violet to-cyan px-4 py-2 text-center font-semibold text-canvas"
          >
            {t('next.play')}
          </a>
        ) : (
          <Link
            to={`/library/${game.id}`}
            className="flex-1 rounded-xl bg-linear-to-r from-violet to-cyan px-4 py-2 text-center font-semibold text-canvas"
          >
            {t('next.details')}
          </Link>
        )}
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="rounded-xl border border-line px-4 py-2 font-semibold text-muted transition hover:text-fg disabled:opacity-50"
          >
            {t('next.another')}
          </button>
        )}
      </div>

      {/* A new game, a new question: the confirmation starts closed. */}
      <FeedbackButtons
        key={game.id}
        busy={busy}
        onAnswer={(action) => onAnswer(game, action)}
      />
    </div>
  );
}

/**
 * "Not now" and "I won't play it", small and below: they shouldn't compete
 * with playing. The second asks first, a mistap on a phone is easy.
 */
function FeedbackButtons({
  busy,
  onAnswer,
}: {
  busy: boolean;
  onAnswer: (action: RecommendationFeedbackAction) => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
        <p className="text-sm text-fg/90">{t('next.neverConfirm')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAnswer('NEVER')}
            disabled={busy}
            className="flex-1 rounded-xl border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-50"
          >
            {t('next.neverYes')}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted hover:text-fg"
          >
            {t('next.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-6 text-sm">
      <button
        type="button"
        onClick={() => onAnswer('NOT_NOW')}
        disabled={busy}
        className="text-muted transition hover:text-fg disabled:opacity-50"
      >
        {t('next.notNow')}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="text-muted transition hover:text-fg disabled:opacity-50"
      >
        {t('next.never')}
      </button>
    </div>
  );
}

/**
 * What the last answer did. "Not now" can be undone right here; "I won't
 * play it" from the game page, where the status can be changed back.
 */
function AnsweredNotice({
  answered,
  onUndone,
}: {
  answered: Answered;
  onUndone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const update = useUpdateLibraryGame(answered.id);
  const text = answered.snoozedUntil
    ? t('next.snoozed', {
        title: answered.title,
        date: new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'long',
        }).format(new Date(answered.snoozedUntil)),
      })
    : t('next.discarded', { title: answered.title });

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2 text-sm"
    >
      <p className="text-fg/90">{text}</p>
      {answered.snoozedUntil ? (
        <button
          type="button"
          onClick={() =>
            update.mutate({ snoozedUntil: null }, { onSuccess: onUndone })
          }
          disabled={update.isPending}
          className="shrink-0 font-semibold text-cyan disabled:opacity-50"
        >
          {t('next.undo')}
        </button>
      ) : (
        <Link
          to={`/library/${answered.id}`}
          className="shrink-0 font-semibold text-cyan"
        >
          {t('next.details')}
        </Link>
      )}
    </div>
  );
}

function Alternative({ game }: { game: Recommendation }) {
  return (
    <Link
      to={`/library/${game.id}`}
      className="flex items-center gap-3 rounded-xl bg-canvas p-2 transition hover:bg-canvas/60"
    >
      <GameCover
        title={game.title}
        coverUrl={game.coverUrl}
        heroUrl={game.heroUrl}
        className="w-10 shrink-0 rounded-md"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{game.title}</p>
        <ReasonsLine
          reasons={game.reasons.slice(0, 1)}
          className="truncate text-xs text-muted"
        />
      </div>
    </Link>
  );
}
