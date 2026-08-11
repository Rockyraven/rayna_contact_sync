import 'dotenv/config';
import { Pool } from 'pg';

const isRemote = /sslmode=require|neon\.tech|amazonaws\.com/.test(process.env.DATABASE_URL ?? '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});

export default pool;
