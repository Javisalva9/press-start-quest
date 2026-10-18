import { MOODS, type Mood } from '@psq/shared';
import { useTranslation } from 'react-i18next';

/** "How much do you feel like?": any, short, medium or epic. */
export function MoodPicker({
  mood,
  onChange,
}: {
  mood: Mood | null;
  onChange: (mood: Mood | null) => void;
}) {
  const { t } = useTranslation();
  const options: Array<Mood | null> = [null, ...MOODS];
  return (
    <div
      role="group"
      aria-label={t('next.mood.label')}
      // One row on a phone too: four equal columns.
      className="grid grid-cols-4 gap-2"
    >
      {options.map((option) => {
        const active = option === mood;
        return (
          <button
            key={option ?? 'any'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            title={option ? t(`next.mood.hint.${option}`) : undefined}
            className={`truncate rounded-full border px-2 py-1 text-sm transition ${
              active
                ? 'border-cyan bg-cyan/15 text-fg'
                : 'border-line text-muted'
            }`}
          >
            {t(option ? `next.mood.${option}` : 'next.mood.any')}
          </button>
        );
      })}
    </div>
  );
}
