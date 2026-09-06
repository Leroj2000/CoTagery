import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  // rawBody: potřebné pro ověření podpisu PSP webhooků (EPIC-17).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const httpAdapter = app.getHttpAdapter().getInstance() as { disable?: (name: string) => void };
  httpAdapter.disable?.('x-powered-by');
  // Resolver hot path běží na /r/{code} mimo /api/v1 (krátká veřejná URL – ADR-0002).
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'r/:code', method: RequestMethod.GET },
      { path: 'r/:code/activate', method: RequestMethod.POST },
      { path: 'r/:code/found', method: RequestMethod.POST },
    ],
  });
  const config = app.get(ConfigService);
  app.enableCors({
    origin: parseCorsOrigins(config.get<string>('CORS_ORIGINS')),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.use(
    (_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(self), bluetooth=(self), geolocation=()');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      next();
    },
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = config.get<number>('API_PORT') ?? 3001;

  await app.listen(port, '0.0.0.0');
  console.log(`Tagery API běží na http://localhost:${port}/api/v1`);
}

void bootstrap();
