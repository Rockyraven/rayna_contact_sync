import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, avatar_url, created_at, updated_at
       FROM users
       ORDER BY updated_at DESC`,
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Failed to load users:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load users' });
  }
});

export default router;
