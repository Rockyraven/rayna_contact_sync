import 'dotenv/config';
import { Pool } from 'pg';

const isRemote = /sslmode=require|neon\.tech|amazonaws\.com/.test(process.env.DATABASE_URL ?? '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  // Default is 10 — too tight for 1000+ concurrent users on a single
  // instance. This still needs to stay comfortably under whatever
  // max_connections the actual Postgres server allows.
  max: Number(process.env.DB_POOL_MAX ?? 30),
});

export default pool;
