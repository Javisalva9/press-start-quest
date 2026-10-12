import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Todas las rutas cuelgan de /api (por ejemplo, /api/health).
  app.setGlobalPrefix('api');

  // Solo la web (o las URLs que pongas en CORS_ORIGIN) puede llamar a la API desde el navegador.
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
  });

  // Cierra bien las conexiones a la base de datos cuando Render reinicia el servicio.
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Press Start Quest API')
    .setVersion('0.0.0')
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, swagger),
  );

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api`, 'Bootstrap');
}

await bootstrap();
