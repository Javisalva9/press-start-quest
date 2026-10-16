import { useQueryClient } from '@tanstack/react-query';
import type { ReviewCard } from '@psq/shared';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useAnswerReview, useReviewQueue } from '../api/review';
import { GameCover } from '../components/GameCover';
import { formatHours } from '../format';
import {
  ANSWER_BY_DIRECTION,
  DIRECTION_BY_KEY,
  DIRECTIONS,
  reasonFor,
  swipeDirection,
  type SwipeDirection,
} from '../review';

/** Cards asked for at a time; more are fetched before running out. */
const BATCH = 20;
const REFILL_BELOW = 3;

/** Drag distance that answers, in px. */
const SWIPE_THRESHOLD = 90;

/** How long the card takes to fly away before the next one shows. */
const LEAVE_MS = 200;

/** Where a card flies to, per direction. */
const LEAVE_OFFSET: Record<SwipeDirection, [number, number]> = {
  right: [600, 0],
  left: [-600, 0],
  down: [0, 700],
  up: [0, -700],
};

/** Icons of the two questions: they tell the cards apart without reading. */
const FINISHED_ICON = '✓';
const PAUSED_ICON = '⏸';

const ARROW: Record<SwipeDirection, string> = {
  right: '→',
  left: '←',
  down: '↓',
  up: '↑',
};

/**
 * The review ("Repaso" in Spanish, "Catch up" in English, so it isn't
 * mistaken for a game review, which the app calls notes): "did you finish
 * it?" one card at a time: swipe right (yes), left (no),
 * down (I dropped it) or up (I won't play it), or use the buttons or the
 * arrow keys. Answered cards leave at once; the answer is saved behind.
 */
export default function ReviewPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queue = useReviewQueue(BATCH);
  const answer = useAnswerReview();
  // Answered in this visit: hidden right away, without waiting for the API.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Before the first "did you drop it?" card, a pause that says the
  // question changes: after many "did you finish it?" swipes, a different
  // line on the card goes unread.
  const [pausedIntroSeen, setPausedIntroSeen] = useState(false);
  // "7 months ago" is counted from when the screen opened: a fixed value,
  // so every render of a card says the same.
  const [now] = useState(() => new Date());

  const cards = (queue.data?.items ?? []).filter(
    (card) => !answered.has(card.id),
  );
  const answeredHere = (queue.data?.items ?? []).filter((card) =>
    answered.has(card.id),
  ).length;
  const remaining = Math.max(0, (queue.data?.total ?? 0) - answeredHere);

  // Running low and there's more on the server: ask for the next batch.
  // The server leaves answered games out on its own.
  const { refetch, isFetching } = queue;
  useEffect(() => {
    if (
      cards.length < REFILL_BELOW &&
      remaining > cards.length &&
      !isFetching
    ) {
      void refetch();
    }
  }, [cards.length, remaining, isFetching, refetch]);

  // The home screen shows how many are waiting: fresh when going back.
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
    [queryClient],
  );

  const onAnswer = useCallback(
    (card: ReviewCard, direction: SwipeDirection) => {
      const value = ANSWER_BY_DIRECTION[direction];
      setError(null);
      setAnswered((previous) => new Set(previous).add(card.id));
      if (value === 'finished') {
        // A short buzz on Android to celebrate; iPhones ignore it.
        navigator.vibrate?.(40);
      }
      answer.mutate(
        { id: card.id, answer: value },
        {
          onError: (failure) => {
            // Put the card back so the answer can be given again.
            setAnswered((previous) => {
              const next = new Set(previous);
              next.delete(card.id);
              return next;
            });
            const code =
              failure instanceof ApiRequestError && failure.code
                ? failure.code
                : 'UNKNOWN';
            setError(t(`errors.${code}`));
          },
        },
      );
    },
    [answer, t],
  );

  if (queue.isPending) {
    return <p className="p-6 text-muted">{t('home.loading')}</p>;
  }
  if (queue.isError) {
    return (
      <p role="alert" className="p-6 text-danger">
        {t('errors.UNKNOWN')}
      </p>
    );
  }

  const [current, next] = cards;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-6 pb-24">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold">{t('review.title')}</h1>
        {remaining > 0 && (
          <p className="text-sm text-muted">
            {t('review.remaining', { count: remaining })}
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {current?.question === 'abandoned' && !pausedIntroSeen ? (
        <section className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-muted bg-card p-8 text-center">
          <span aria-hidden className="text-4xl">
            {PAUSED_ICON}
          </span>
          <h2 className="font-display text-xl font-bold">
            {t('review.pausedIntro.title')}
          </h2>
          <p className="text-muted">{t('review.pausedIntro.body')}</p>
          <button
            type="button"
            onClick={() => setPausedIntroSeen(true)}
            className="rounded-xl border border-line bg-canvas px-5 py-2 font-semibold"
          >
            {t('review.pausedIntro.continue')}
          </button>
        </section>
      ) : current ? (
        <>
          <div className="relative h-[30rem]">
            {next && (
              <div className="absolute inset-0 scale-95 opacity-60" aria-hidden>
                <CardFace card={next} now={now} />
              </div>
            )}
            <SwipeCard
              key={current.id}
              card={current}
              now={now}
              onAnswer={onAnswer}
            />
          </div>
          <AnswerButtons card={current} onAnswer={onAnswer} />
          <p className="text-center text-xs text-muted">{t('review.hint')}</p>
        </>
      ) : (
        <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-line bg-card p-8 text-center">
          <p className="font-display text-xl font-bold">
            {t('review.done.title')}
          </p>
          <p className="text-muted">{t('review.done.body')}</p>
          <Link to="/library" className="font-semibold text-cyan">
            {t('review.done.library')}
          </Link>
        </section>
      )}
    </main>
  );
}

/** The card on top: follows the finger, and flies away when answered. */
function SwipeCard({
  card,
  now,
  onAnswer,
}: {
  card: ReviewCard;
  now: Date;
  onAnswer: (card: ReviewCard, direction: SwipeDirection) => void;
}) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState<[number, number]>([0, 0]);
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null);
  // State, not only the ref: the card looks different while dragged.
  const [dragging, setDragging] = useState(false);
  const start = useRef<[number, number] | null>(null);

  const leave = useCallback(
    (direction: SwipeDirection) => {
      if (leaving) {
        return;
      }
      setLeaving(direction);
      setOffset(LEAVE_OFFSET[direction]);
      window.setTimeout(() => onAnswer(card, direction), LEAVE_MS);
    },
    [card, leaving, onAnswer],
  );

  // Arrow keys, on a computer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = DIRECTION_BY_KEY[event.key];
      if (direction) {
        event.preventDefault();
        leave(direction);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (leaving) {
      return;
    }
    // Keep receiving the moves even if the finger leaves the card.
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = [event.clientX - offset[0], event.clientY - offset[1]];
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current) {
      setOffset([
        event.clientX - start.current[0],
        event.clientY - start.current[1],
      ]);
    }
  };
  const onPointerUp = () => {
    if (!start.current) {
      return;
    }
    start.current = null;
    setDragging(false);
    const direction = swipeDirection(offset[0], offset[1], SWIPE_THRESHOLD);
    if (direction) {
      leave(direction);
    } else {
      setOffset([0, 0]); // Not far enough: back to the middle.
    }
  };

  // The answer a release would give, shown on the card while dragging.
  const hint =
    leaving ?? swipeDirection(offset[0], offset[1], SWIPE_THRESHOLD / 2);
  const strength = Math.min(
    1,
    Math.max(Math.abs(offset[0]), Math.abs(offset[1])) / SWIPE_THRESHOLD,
  );

  return (
    <div
      role="group"
      aria-label={card.title}
      className={`absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing ${
        dragging
          ? ''
          : 'transition-transform duration-200 ease-out motion-reduce:transition-none'
      }`}
      style={{
        transform: `translate(${offset[0]}px, ${offset[1]}px) rotate(${offset[0] / 20}deg)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <CardFace card={card} now={now} />
      {hint && (
        <div
          aria-hidden
          className={`pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-xl border-2 px-4 py-2 font-display text-xl font-bold uppercase ${
            hint === 'right'
              ? 'border-success text-success'
              : hint === 'down'
                ? 'border-danger text-danger'
                : 'border-fg text-fg'
          } bg-canvas/80`}
          style={{ opacity: leaving ? 1 : strength }}
        >
          {answerLabel(t, card, hint)}
        </div>
      )}
    </div>
  );
}

/** What a card shows: cover, title, the question and why we ask. */
function CardFace({ card, now }: { card: ReviewCard; now: Date }) {
  const { t, i18n } = useTranslation();
  const hours = (minutes: number) => formatHours(minutes, i18n.language);
  const reason = reasonFor(card, now, hours);
  const paused = card.question === 'abandoned';
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-card ${
        paused ? 'border-dashed border-muted' : 'border-line'
      }`}
    >
      {/* The question first, with an icon: told apart without reading. */}
      <p
        className={`mx-auto mt-4 rounded-full px-4 py-1 text-sm font-semibold ${
          paused ? 'bg-fg/10 text-fg' : 'bg-cyan/15 text-cyan'
        }`}
      >
        <span aria-hidden className="mr-1.5">
          {paused ? PAUSED_ICON : FINISHED_ICON}
        </span>
        {paused
          ? t('review.question.abandoned')
          : t('review.question.finished')}
      </p>
      <GameCover
        title={card.title}
        coverUrl={card.coverUrl}
        heroUrl={card.heroUrl}
        className="pointer-events-none mx-auto mt-4 w-40 shrink-0"
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center">
        <h2 className="font-display text-xl font-bold">{card.title}</h2>
        <p className="text-sm text-muted">{t(reason.key, reason.values)}</p>
      </div>
    </article>
  );
}

/** The same four answers as buttons: for a mouse, and for accessibility. */
function AnswerButtons({
  card,
  onAnswer,
}: {
  card: ReviewCard;
  onAnswer: (card: ReviewCard, direction: SwipeDirection) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      {DIRECTIONS.map((direction) => (
        <button
          key={direction}
          type="button"
          onClick={() => onAnswer(card, direction)}
          className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
            // The highlighted answer is "yes, I finished it" only where
            // it's the likely one: not on "did you drop it?".
            direction === 'right' && card.question === 'finished'
              ? 'border-transparent bg-linear-to-r from-violet to-cyan text-canvas'
              : 'border-line bg-card text-fg hover:border-muted'
          }`}
        >
          <span aria-hidden className="mr-1">
            {ARROW[direction]}
          </span>
          {answerLabel(t, card, direction)}
        </button>
      ))}
    </div>
  );
}

function answerLabel(
  t: ReturnType<typeof useTranslation>['t'],
  card: ReviewCard,
  direction: SwipeDirection,
): string {
  switch (ANSWER_BY_DIRECTION[direction]) {
    case 'finished':
      // On "did you drop it?", a bare "yes" would read as "yes, I dropped
      // it": spelled out instead.
      return card.question === 'abandoned'
        ? t('review.answer.finishedIt')
        : t('review.answer.finished');
    case 'notFinished':
      // On "did you drop it?", "no" means "I'll get back to it".
      return card.question === 'abandoned'
        ? t('review.answer.resume')
        : t('review.answer.notFinished');
    case 'abandoned':
      return t('review.answer.abandoned');
    case 'wontPlay':
      return t('review.answer.wontPlay');
  }
}
