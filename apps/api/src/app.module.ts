import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { ApiValidationPipe } from './common/api-validation.pipe.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { LibraryModule } from './library/library.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SourcesModule } from './sources/sources.module.js';
import { SyncModule } from './sync/sync.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // Reads apps/api/.env locally; on Render the variables come from the dashboard.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SourcesModule,
    SyncModule,
    LibraryModule,
  ],
  providers: [
    // Global pipe registered here (not in main.ts) so tests get it too.
    { provide: APP_PIPE, useClass: ApiValidationPipe },
  ],
})
export class AppModule {}
