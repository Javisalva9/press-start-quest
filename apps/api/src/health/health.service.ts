import { Injectable, Logger } from '@nestjs/common';
import type { HealthResponse } from '@psq/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    return {
      status: 'ok',
      database: (await this.isDatabaseUp()) ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }

  private async isDatabaseUp(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      // Solo el mensaje: nunca se registra la cadena de conexión.
      this.logger.warn(
        `La base de datos no responde: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
