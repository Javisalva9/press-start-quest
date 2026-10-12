import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';

/**
 * Único punto de acceso a la base de datos.
 * Los servicios de cada módulo lo inyectan; los controladores nunca.
 *
 * No se conecta al arrancar: Prisma abre la conexión en la primera consulta.
 * Así la API arranca aunque Neon esté suspendida y la despierta cuando hace falta.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
