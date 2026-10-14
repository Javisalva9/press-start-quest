import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';

/**
 * Single entry point to the database.
 * Each module's services inject it; controllers never do.
 *
 * It doesn't connect at startup: Prisma opens the connection on the first query.
 * That way the API boots even while Neon is suspended, and wakes it up when needed.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnApplicationShutdown
{
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  /**
   * The last shutdown phase, so services can still use the database in
   * the earlier ones (SyncService closes its jobs in beforeApplicationShutdown).
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
