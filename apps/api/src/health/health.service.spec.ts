import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@psq/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const prisma = { $queryRaw: vi.fn() };
  let service: HealthService;

  beforeEach(async () => {
    prisma.$queryRaw.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it('reports the database as up', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const result = await service.check();
    expect(result.database).toBe('up');
    expect(HealthResponseSchema.safeParse(result).success).toBe(true);
  });

  it('keeps responding when the database fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const result = await service.check();
    expect(result).toMatchObject({ status: 'ok', database: 'down' });
  });
});
