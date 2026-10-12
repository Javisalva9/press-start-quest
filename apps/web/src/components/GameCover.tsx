/**
 * 3:4 cover. Falls back to the wide Steam header (cropped), and to the
 * title on a plain card when there's no image at all.
 */
export function GameCover({
  title,
  coverUrl,
  heroUrl,
  className = '',
}: {
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  className?: string;
}) {
  const src = coverUrl ?? heroUrl;
  return (
    <div
      className={`aspect-3/4 overflow-hidden rounded-xl border border-line bg-card ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center p-2 text-center text-xs text-muted">
          {title}
        </div>
      )}
    </div>
  );
}
