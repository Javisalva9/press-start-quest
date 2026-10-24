import type { StatsOverview } from '@psq/shared';
import {
  GameStatus,
  GameType,
  ServerStatus,
} from '../generated/prisma/client.js';

export interface ProgressEntry {
  status: GameStatus;
  /** The player's type if any, else the catalog's. */
  gameType: GameType;
  /** The player's mark if any, else the catalog's. */
  serverStatus: ServerStatus;
  playtimeMin: number;
  ttbMainMin: number | null;
}

type Counts = Omit<StatsOverview, 'streak' | 'pace'>;

/**
 * The progress counts of an owned library, by the plan's rules. In order,
 * so each game lands in one box only:
 *
 * - "I won't play it" and endless games are out of the chart.
 * - Completed counts, even if the servers closed afterwards.
 * - Closed servers take a game out of the pending total.
 * - Abandoned is the player's decision: neither pending nor in the ring.
 * - Everything else is pending, sandboxes included; its remaining main
 *   story adds up, except for sandboxes, whose length says nothing.
 */
export function summarizeProgress(entries: ProgressEntry[]): Counts {
  const counts: Counts = {
    completed: 0,
    pending: 0,
    abandoned: 0,
    endless: 0,
    closed: 0,
    discarded: 0,
    remainingMinutes: 0,
    pendingWithoutLength: 0,
  };
  for (const entry of entries) {
    if (entry.status === GameStatus.DISCARDED) {
      counts.discarded += 1;
    } else if (entry.gameType === GameType.ENDLESS) {
      counts.endless += 1;
    } else if (entry.status === GameStatus.COMPLETED) {
      counts.completed += 1;
    } else if (entry.serverStatus === ServerStatus.CLOSED) {
      counts.closed += 1;
    } else if (entry.status === GameStatus.ABANDONED) {
      counts.abandoned += 1;
    } else {
      counts.pending += 1;
      if (entry.gameType !== GameType.SANDBOX) {
        if (entry.ttbMainMin) {
          counts.remainingMinutes += Math.max(
            0,
            entry.ttbMainMin - entry.playtimeMin,
          );
        } else {
          counts.pendingWithoutLength += 1;
        }
      }
    }
  }
  return counts;
}

/**
 * Streaks from the days played (YYYY-MM-DD, any order). The current one
 * is still alive if the last day played is today or yesterday: today may
 * simply not have been played yet.
 */
export function streaks(
  daysPlayed: string[],
  today: string,
): Pick<StatsOverview['streak'], 'current' | 'best' | 'lastPlayedDay'> {
  const days = [...new Set(daysPlayed)].sort();
  if (days.length === 0) {
    return { current: 0, best: 0, lastPlayedDay: null };
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === addDays(days[i - 1]!, 1) ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const last = days.at(-1)!;
  const alive = last === today || last === addDays(today, -1);
  return { current: alive ? run : 0, best, lastPlayedDay: last };
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
