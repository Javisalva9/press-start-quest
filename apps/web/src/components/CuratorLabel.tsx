import type { RecommendedBy } from '@psq/shared';

/** Used when a curator has no color of its own. */
const NEUTRAL = 'var(--color-muted)';

/**
 * A curator's label on a game ("AlexElCapso"), in its color: text and
 * border, so it reads on the dark cards whatever the color.
 */
export function CuratorLabel({
  curator,
  children,
}: {
  curator: RecommendedBy;
  children?: React.ReactNode;
}) {
  const color = curator.color ?? NEUTRAL;
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{ color, borderColor: color }}
    >
      {children ?? curator.name}
    </span>
  );
}
