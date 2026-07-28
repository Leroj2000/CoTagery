import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

// Standalone DataSource pro TypeORM CLI (migrace, seed).
// Načte .env z kořene monorepa; reálné env (Docker) má přednost.
loadEnv({ path: join(__dirname, '../../../../../.env') });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../../**/*.entity.{ts,js}')],
  migrations: [join(__dirname, '../../database/migrations/*.{ts,js}')],
  synchronize: false,
});
