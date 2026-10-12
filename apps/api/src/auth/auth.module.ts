import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { SteamModule } from '../providers/steam/steam.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
    SteamModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    // Registered as a global guard: protects every route of the API.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
