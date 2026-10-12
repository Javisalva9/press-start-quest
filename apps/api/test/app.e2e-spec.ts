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
    user: { findUnique: vi.fn() },
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
      sources: [{ externalId: '76561197960287930' }],
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
        });
      });
  });
});
