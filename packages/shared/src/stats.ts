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
  /**
   * How fast the backlog goes at the recent pace; null with under a week
   * of history. The default keeps the web app working against an API
   * deployed a moment earlier without it (Render deploys them separately).
   */
  pace: z
    .object({
      /** Days the pace is measured over: the last 30, or fewer if newer. */
      windowDays: z.number().int().positive(),
      /** Minutes a day on games that count (endless ones don't). */
      minutesPerDay: z.number().nonnegative(),
      /** Days to play the hours left; null without play in the window. */
      etaDays: z.number().int().nonnegative().nullable(),
    })
    .nullable()
    .default(null),
});

export type StatsOverview = z.infer<typeof StatsOverviewSchema>;

/** One month of GET /api/stats/timeline. */
export const TimelineMonthSchema = z.object({
  /** YYYY-MM, by gaming days (they end at 4:00 in Madrid). */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** Games completed that month. */
  completed: z.number().int().nonnegative(),
  /** Minutes played that month, every game included. */
  playedMinutes: z.number().int().nonnegative(),
});

export type TimelineMonth = z.infer<typeof TimelineMonthSchema>;

/** Response of GET /api/stats/timeline: up to the last 12 months. */
export const StatsTimelineSchema = z.object({
  /** Oldest first, months without anything included, up to this one. */
  months: z.array(TimelineMonthSchema),
});

export type StatsTimeline = z.infer<typeof StatsTimelineSchema>;

/**
 * Kinds of milestone: games completed in total, the best streak of
 * gaming days, and completing something this month (it starts again
 * every month).
 */
export const MILESTONE_KINDS = ['COMPLETED', 'STREAK', 'MONTH'] as const;

export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

/** One milestone, reached or the next one to reach. */
export const MilestoneSchema = z.object({
  kind: z.enum(MILESTONE_KINDS),
  /** 10 completed, a 7-day streak, 1 this month. */
  target: z.number().int().positive(),
  /** How far the player is: past the target once reached. */
  current: z.number().int().nonnegative(),
  /** The gaming day it was reached; null while it isn't. */
  reachedOn: z.iso.date().nullable(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

/** Response of GET /api/stats/milestones. */
export const StatsMilestonesSchema = z.object({
  /** Reached ones, the newest first. */
  reached: z.array(MilestoneSchema),
  /** The next one of each kind still ahead. */
  next: z.array(MilestoneSchema),
});

export type StatsMilestones = z.infer<typeof StatsMilestonesSchema>;
