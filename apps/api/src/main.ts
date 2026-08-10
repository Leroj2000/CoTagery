import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody: potřebné pro ověření podpisu PSP webhooků (EPIC-17).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Resolver hot path běží na /r/{code} mimo /api/v1 (krátká veřejná URL – ADR-0002).
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'r/:code', method: RequestMethod.GET },
      { path: 'r/:code/activate', method: RequestMethod.POST },
    ],
  });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT') ?? 3001;

  await app.listen(port, '0.0.0.0');
  console.log(`Tagery API běží na http://localhost:${port}/api/v1`);
}

void bootstrap();
