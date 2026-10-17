import { z } from 'zod';

/** Response of GET /api/stats/overview: the home screen's progress. */
export const StatsOverviewSchema = z.object({
  /** In the progress ring. */
  completed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  /** Out of the ring, shown on their own. */
  abandoned: z.number().int().nonnegative(),
  endless: z.number().int().nonnegative(),
  /** Servers closed and not completed: out of the pending total. */
  closed: z.number().int().nonnegative(),
  /** "I won't play it": out of everything. */
  discarded: z.number().int().nonnegative(),
  /** Main story left in the pending games with a known length. */
  remainingMinutes: z.number().int().nonnegative(),
  /** Pending games (not sandboxes) whose length nobody knows. */
  pendingWithoutLength: z.number().int().nonnegative(),
  streak: z.object({
    /** Gaming days in a row up to today or yesterday; 0 if broken. */
    current: z.number().int().nonnegative(),
    best: z.number().int().nonnegative(),
    lastPlayedDay: z.iso.date().nullable(),
    /** First day of playtime history: streaks count from here. */
    since: z.iso.date().nullable(),
  }),
});

export type StatsOverview = z.infer<typeof StatsOverviewSchema>;
