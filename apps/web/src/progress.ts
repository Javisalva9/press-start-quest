/** Share of completed games in the ring, as a whole percentage. */
export function ringPercent(completed: number, pending: number): number {
  const total = completed + pending;
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}
