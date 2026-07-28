import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT') ?? 3001;

  await app.listen(port, '0.0.0.0');
  console.log(`Tagery API běží na http://localhost:${port}/api/v1`);
}

void bootstrap();
