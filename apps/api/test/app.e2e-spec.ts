import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Tests the whole app (modules, routes, guards, /api prefix) without a real
// database: PrismaService is replaced by a test double.
describe('API (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health is public', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
      });
  });

  it('GET /api/auth/steam redirects to Steam with our callback', () => {
    return request(app.getHttpServer())
      .get('/api/auth/steam')
      .expect(302)
      .expect((res) => {
        const location = new URL(res.headers.location);
        expect(location.host).toBe('steamcommunity.com');
        expect(location.searchParams.get('openid.return_to')).toBe(
          'http://localhost:5173/auth/steam/callback',
        );
      });
  });

  it('POST /api/auth/steam validates the body', () => {
    return request(app.getHttpServer())
      .post('/api/auth/steam')
      .send({ query: '' })
      .expect(400)
      .expect((res) => {
        expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });
  });

  it('POST /api/auth/steam rejects a forged Steam response', () => {
    return request(app.getHttpServer())
      .post('/api/auth/steam')
      .send({ query: '?openid.mode=id_res' })
      .expect(401)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 401,
          code: 'STEAM_LOGIN_INVALID',
        });
      });
  });

  it('POST /api/auth/refresh rejects an unknown refresh token', () => {
    return request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 401,
          code: 'REFRESH_TOKEN_INVALID',
        });
      });
  });

  it('POST /api/auth/logout closes the session', () => {
    return request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: 'some-token' })
      .expect(204);
  });

  it('GET /api/sources/steam/privacy requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/sources/steam/privacy')
      .expect(401);
  });

  describe('POST /api/internal/jobs/daily', () => {
    const route = '/api/internal/jobs/daily';

    it('needs the jobs token', () => {
      return request(app.getHttpServer()).post(route).expect(401);
    });

    it("doesn't take a user's session instead", async () => {
      const userToken = await app
        .get(JwtService)
        .signAsync({ sub: 'u1' }, { algorithm: 'HS256' });
      return request(app.getHttpServer())
        .post(route)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);
    });

    it('runs with the jobs token', () => {
      return request(app.getHttpServer())
        .post(route)
        .set('Authorization', `Bearer ${process.env.JOBS_TOKEN}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            users: 0,
            synced: 0,
            skipped: 0,
            failed: 0,
          });
        });
    });
  });

  it('GET /api/games/search requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/games/search?q=hades')
      .expect(401);
  });

  it('POST /api/library/manual requires a token', () => {
    return request(app.getHttpServer())
      .post('/api/library/manual')
      .send({ origin: 'wishlist', igdbId: 1 })
      .expect(401);
  });

  it('GET /api/sources/external requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/sources/external')
      .expect(401);
  });

  it('GET /api/stats/overview requires a token', () => {
    return request(app.getHttpServer()).get('/api/stats/overview').expect(401);
  });

  it('GET /api/curators requires a token', () => {
    return request(app.getHttpServer()).get('/api/curators').expect(401);
  });

  it('DELETE /api/library/:id/wishlist requires a token', () => {
    return request(app.getHttpServer())
      .delete('/api/library/x/wishlist')
      .expect(401);
  });

  it('GET /api/library/:id/achievements requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/library/x/achievements')
      .expect(401);
  });

  it('PUT /api/library/:id/achievements/:id/finale-vote requires a token', () => {
    return request(app.getHttpServer())
      .put('/api/library/x/achievements/a/finale-vote')
      .send({ isFinale: true })
      .expect(401);
  });

  it('GET /api/taste-profile requires a token', () => {
    return request(app.getHttpServer()).get('/api/taste-profile').expect(401);
  });

  it('GET /api/library requires a token', () => {
    return request(app.getHttpServer()).get('/api/library').expect(401);
  });

  it('GET /api/library/review-queue requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/library/review-queue')
      .expect(401);
  });

  it('POST /api/library/review-queue/:id requires a token', () => {
    return request(app.getHttpServer())
      .post('/api/library/review-queue/x')
      .send({ answer: 'finished' })
      .expect(401);
  });

  it('PATCH /api/library/:id requires a token', () => {
    return request(app.getHttpServer())
      .patch('/api/library/x')
      .send({ status: 'COMPLETED' })
      .expect(401);
  });

  it('PATCH /api/library/:id/length requires a token', () => {
    return request(app.getHttpServer())
      .patch('/api/library/x/length')
      .send({ minutes: 600 })
      .expect(401);
  });

  it('POST /api/sync requires a token', () => {
    return request(app.getHttpServer()).post('/api/sync').expect(401);
  });

  it('GET /api/me requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/me')
      .expect(401)
      .expect((res) => {
        expect(res.body).toEqual({ statusCode: 401, code: 'UNAUTHENTICATED' });
      });
  });

  it('GET /api/me rejects a token signed with another secret', async () => {
    const forged = await new JwtService({
      secret: 'another-secret-that-is-at-least-32-characters',
    }).signAsync({ sub: 'u1' });
    return request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('GET /api/me returns the signed-in user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      displayName: 'Javi',
      locale: 'es',
      sources: [{ externalId: '76561197960287930', lastSyncAt: null }],
    });
    const token = await app.get(JwtService).signAsync({ sub: 'u1' });

    return request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          id: 'u1',
          displayName: 'Javi',
          locale: 'es',
          steamId: '76561197960287930',
          lastSyncAt: null,
        });
      });
  });
});
