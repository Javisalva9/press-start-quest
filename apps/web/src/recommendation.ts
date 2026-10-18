import type { RecommendationReason } from '@psq/shared';
import { formatHours } from './format';
import { tagLabel } from './tag-names';

/**
 * A reason's text key and its values. Kept apart from the component so
 * the wording rules can be tested without rendering anything.
 */
export function reasonMessage(
  reason: RecommendationReason,
  language: string,
):
  | { key: 'next.reason.TASTE_MATCH'; values: { tag: string } }
  | { key: 'next.reason.TIME_LEFT'; values: { hours: string } }
  | { key: 'next.reason.KEEP_GOING'; values: { percent: number } }
  | { key: 'next.reason.KEEP_GOING_HOURS'; values: { hours: string } }
  | { key: 'next.reason.HIGHLY_RATED'; values: { rating: number } }
  | { key: 'next.reason.RECOMMENDED_BY'; values: { curator: string } }
  | { key: 'next.reason.SERVERS_CLOSING'; values: { date: string } }
  | { key: 'next.reason.SERVERS_CLOSING_SOON'; values: Record<string, never> } {
  switch (reason.code) {
    case 'TASTE_MATCH':
      return {
        key: 'next.reason.TASTE_MATCH',
        values: { tag: tagLabel(reason.tag, language) },
      };
    case 'TIME_LEFT':
      return {
        key: 'next.reason.TIME_LEFT',
        values: { hours: formatHours(reason.minutes, language) },
      };
    case 'KEEP_GOING':
      return reason.percent === null
        ? {
            key: 'next.reason.KEEP_GOING_HOURS',
            values: { hours: formatHours(reason.playedMinutes, language) },
          }
        : {
            key: 'next.reason.KEEP_GOING',
            values: { percent: reason.percent },
          };
    case 'HIGHLY_RATED':
      return {
        key: 'next.reason.HIGHLY_RATED',
        values: { rating: reason.rating },
      };
    case 'RECOMMENDED_BY':
      return {
        key: 'next.reason.RECOMMENDED_BY',
        values: { curator: reason.curator },
      };
    case 'SERVERS_CLOSING':
      return reason.closesAt
        ? {
            key: 'next.reason.SERVERS_CLOSING',
            values: {
              date: new Intl.DateTimeFormat(language, {
                dateStyle: 'long',
                timeZone: 'UTC',
              }).format(new Date(reason.closesAt)),
            },
          }
        : { key: 'next.reason.SERVERS_CLOSING_SOON', values: {} };
  }
}

/**
 * Steam's link to start a game on this computer. Null where it makes no
 * sense: on a phone (Steam can't run a PC game there) or without an appid.
 */
export function steamRunUrl(
  steamAppId: number | null,
  hasMouse: boolean,
): string | null {
  return steamAppId !== null && hasMouse
    ? `steam://rungameid/${steamAppId}`
    : null;
}
