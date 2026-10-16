import { SnapshotRecorder } from './snapshot-recorder.js';

describe('SnapshotRecorder', () => {
  it('writes every photo in one statement, with the values as parameters', async () => {
    const prisma = { $executeRaw: vi.fn().mockResolvedValue(3) };
    const recorder = new SnapshotRecorder(prisma as never);

    await expect(
      recorder.record('u1', ['ug1', 'ug2'], '2026-10-17'),
    ).resolves.toBe(3);

    // A tagged template: the SQL pieces and, apart, the values.
    const [sql, ...values] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('ON CONFLICT ("userGameId", "date")');
    expect(values).toEqual(['2026-10-17', 'u1', ['ug1', 'ug2']]);
  });
});
