import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** A session lasts 30 days from its last use: open the app monthly and you stay in. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Right after a rotation, the previous token may still arrive from another
 * tab that refreshed at the same moment: that's not an attack.
 */
const ROTATION_GRACE_MS = 60 * 1000;

/** The refresh token is unknown, expired or no longer valid. */
export class RefreshTokenError extends Error {}

/**
 * Sessions with rotating refresh tokens:
 * - Each refresh token works once: using it returns a new one.
 * - Only the SHA-256 of each token is stored.
 * - If an already used token shows up later, someone else has a copy:
 *   the session is closed for everyone.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Opens a session for a user and returns its first refresh token. */
  async create(userId: string): Promise<string> {
    const now = new Date();
    // Housekeeping: the user's expired sessions are no longer useful.
    await this.prisma.session.deleteMany({
      where: { userId, expiresAt: { lt: now } },
    });

    const refreshToken = newRefreshToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hash(refreshToken),
        expiresAt: expiresFrom(now),
      },
    });
    return refreshToken;
  }

  /**
   * Swaps a refresh token for a new one and returns the session's user.
   * Throws `RefreshTokenError` if the token can't be used.
   */
  async rotate(
    refreshToken: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = hash(refreshToken);
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });
    if (session) {
      if (session.expiresAt <= now) {
        await this.prisma.session.deleteMany({ where: { id: session.id } });
        throw new RefreshTokenError('Session expired');
      }
      const next = newRefreshToken();
      // Conditional update: it only applies if the token is still the current
      // one, so two simultaneous refreshes can't both succeed.
      const { count } = await this.prisma.session.updateMany({
        where: { id: session.id, tokenHash },
        data: {
          tokenHash: hash(next),
          previousTokenHash: tokenHash,
          rotatedAt: now,
          expiresAt: expiresFrom(now),
        },
      });
      if (count === 1) {
        return { userId: session.userId, refreshToken: next };
      }
      throw new RefreshTokenError('Token rotated by another request');
    }

    // Not the current token: maybe the one it replaced.
    const rotated = await this.prisma.session.findUnique({
      where: { previousTokenHash: tokenHash },
    });
    if (
      rotated?.rotatedAt &&
      now.getTime() - rotated.rotatedAt.getTime() > ROTATION_GRACE_MS
    ) {
      // An old token used well after it was replaced: it was copied.
      await this.prisma.session.deleteMany({ where: { id: rotated.id } });
      this.logger.warn(`Refresh token reused: session ${rotated.id} closed`);
    }
    throw new RefreshTokenError('Unknown or already used token');
  }

  /** Closes the session of a refresh token. Does nothing if it doesn't exist. */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hash(refreshToken) },
    });
  }
}

/** 32 random bytes: impossible to guess, so a fast hash is enough to store it. */
function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiresFrom(date: Date): Date {
  return new Date(date.getTime() + SESSION_TTL_MS);
}
