import type { RecommendationReason } from '@psq/shared';
import { useTranslation } from 'react-i18next';
import { reasonMessage } from '../recommendation';

/** "Your kind of game: RPG · 12 h left". */
export function ReasonsLine({
  reasons,
  className = '',
}: {
  reasons: RecommendationReason[];
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  if (reasons.length === 0) {
    return null;
  }
  const text = reasons
    .map((reason) => {
      const { key, values } = reasonMessage(reason, i18n.language);
      return t(key, values);
    })
    .join(' · ');
  return <p className={className}>{text}</p>;
}
