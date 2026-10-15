import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ServerStatus } from '../generated/prisma/client.js';

/**
 * One game whose servers closed or will close. Kept in
 * data/server-status.json: add a line when you hear of a closure, with the
 * source that says so.
 */
const EntrySchema = z.object({
  steamAppId: z.number().int().positive(),
  /** For people reading the file; matching is by app id. */
  title: z.string().min(1),
  /** The day the servers close (or closed). */
  closesOn: z.iso.date(),
  /** What's left afterwards: nothing (CLOSED) or the offline part (PARTIAL). */
  after: z.enum([ServerStatus.CLOSED, ServerStatus.PARTIAL]),
  note: z.string().min(1),
  source: z.url(),
});

const SeedSchema = z.array(EntrySchema).superRefine((entries, context) => {
  const seen = new Set<number>();
  for (const [index, { steamAppId }] of entries.entries()) {
    if (seen.has(steamAppId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'steamAppId'],
        message: `Duplicated app id ${steamAppId}`,
      });
    }
    seen.add(steamAppId);
  }
});

export type ServerStatusEntry = z.infer<typeof EntrySchema>;

/** The file sits in apps/api/data, two levels above both src/ and dist/. */
const SEED_FILE = new URL('../../data/server-status.json', import.meta.url);

/** Reads and checks the list; a malformed file fails loudly, not silently. */
export function loadServerStatusSeed(
  file: URL = SEED_FILE,
): ServerStatusEntry[] {
  return SeedSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

/**
 * The status on a given day. Before the closing day it's ANNOUNCED ("play
 * it before it closes"); from that day on, what's left. So a closure is
 * written once, when it's announced, and turns into CLOSED on its own.
 */
export function serverStatusOn(
  entry: ServerStatusEntry,
  today: Date,
): { status: ServerStatus; closedAt: Date } {
  const closedAt = new Date(`${entry.closesOn}T00:00:00Z`);
  return {
    status: today < closedAt ? ServerStatus.ANNOUNCED : entry.after,
    closedAt,
  };
}
