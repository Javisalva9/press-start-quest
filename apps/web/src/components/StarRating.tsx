import { useTranslation } from 'react-i18next';
import { starFill, tappedRating } from '../stars';
import { PixelStar } from './PixelStar';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Five pixel stars to rate a finished game, in half steps: the left half
 * of a star gives half of it. Tapping the rating already given takes it
 * back. Each half is its own button, with its own label for screen
 * readers. The lit stars bounce when the rating changes.
 */
export function StarRating({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  label: string;
}) {
  const { t, i18n } = useTranslation();
  const format = new Intl.NumberFormat(i18n.language);
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-1 ${disabled ? 'opacity-50' : ''}`}
    >
      {STARS.map((star) => {
        const fill = starFill(star, value);
        return (
          <span key={star} className="relative size-10">
            <PixelStar
              // A new key per rating replays the bounce on the lit stars.
              key={fill > 0 ? `${value}` : 'off'}
              fill={fill}
              className={`absolute inset-x-1 inset-y-2 ${fill > 0 ? 'star-pop' : ''}`}
            />
            {[true, false].map((half) => {
              const stars = half ? star - 0.5 : star;
              return (
                <button
                  key={String(half)}
                  type="button"
                  disabled={disabled}
                  aria-pressed={value === stars}
                  aria-label={t('rating.stars', {
                    count: stars,
                    stars: format.format(stars),
                  })}
                  onClick={() => onChange(tappedRating(star, half, value))}
                  className={`absolute inset-y-0 w-1/2 ${half ? 'left-0' : 'right-0'}`}
                />
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
