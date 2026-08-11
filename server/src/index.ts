import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import contactsRoutes from './routes/contacts';
import usersRoutes from './routes/users';
import emailAccountsRoutes from './routes/emailAccounts';
import adminRoutes from './routes/admin';
import { syncAllLinkedAccounts } from './inboxSync';
import pool from './db';

const app = express();
const PORT = process.env.PORT ?? 4000;
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CORS_ORIGINS.includes(origin) || LOCALHOST_ORIGIN.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json({ limit: '5mb' }));

app.get('/health', async (req, res) => {
  const startedAt = Date.now();
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  try {
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - startedAt;
  } catch (err) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : 'Unknown database error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      server: { status: 'ok' },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
    },
  });
});

app.use('/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/email-accounts', emailAccountsRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Rayna Contact Sync server listening on port ${PORT}`);

  syncAllLinkedAccounts().catch(err => console.error('Initial inbox sync failed:', err));
  setInterval(() => {
    syncAllLinkedAccounts().catch(err => console.error('Background inbox sync failed:', err));
  }, SYNC_INTERVAL_MS);
});
