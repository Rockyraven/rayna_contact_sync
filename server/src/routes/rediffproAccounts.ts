import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { encrypt } from '../crypto';
import { verifyImapLogin } from '../rediffpro/imap';
import { syncRediffproAccount } from '../rediffpro/inboxSync';

const router = Router();

router.use(requireAuth);

router.post('/link', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    await verifyImapLogin(email, password);
  } catch (err) {
    // Deliberately generic here, unlike other routes — this is a credential
    // check, and echoing the raw IMAP error back risks leaking details
    // useful for guessing valid accounts. The real reason still goes to
    // console.error for debugging.
    console.error('Rediffpro IMAP login failed:', err);
    res.status(401).json({ error: 'Could not log in with that email and password' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO rediffpro_accounts (user_id, email, password_encrypted)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, email)
       DO UPDATE SET password_encrypted = $3, updated_at = now()
       RETURNING id`,
      [req.userId, email, encrypt(password)],
    );

    try {
      await syncRediffproAccount(result.rows[0].id);
    } catch (err) {
      console.error('Initial rediffpro sync failed:', err);
    }

    res.json({ email });
  } catch (err) {
    console.error('Failed to store rediffpro account:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to link account' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, created_at, last_synced_at
       FROM rediffpro_accounts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId],
    );
    res.json({ accounts: result.rows });
  } catch (err) {
    console.error('Failed to load rediffpro accounts:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load rediffpro accounts' });
  }
});

router.post('/:id/resync', async (req, res) => {
  try {
    const account = await pool.query(
      `SELECT id FROM rediffpro_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    if (account.rows.length === 0) {
      res.status(404).json({ error: 'Rediffpro account not found' });
      return;
    }

    await syncRediffproAccount(Number(req.params.id));

    const updated = await pool.query(
      `SELECT last_synced_at FROM rediffpro_accounts WHERE id = $1`,
      [req.params.id],
    );
    res.json({ last_synced_at: updated.rows[0].last_synced_at });
  } catch (err) {
    console.error('Manual rediffpro resync failed:', err);
    res.status(502).json({ error: err instanceof Error ? err.message : 'Resync failed' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const account = await pool.query(
      `SELECT id FROM rediffpro_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    if (account.rows.length === 0) {
      res.status(404).json({ error: 'Rediffpro account not found' });
      return;
    }

    const messages = await pool.query(
      `SELECT message_id AS id, from_address AS "from", to_address AS "to",
              cc_address AS "cc", subject, message_date AS "date"
       FROM rediffpro_messages
       WHERE rediffpro_account_id = $1
       ORDER BY message_date DESC
       LIMIT 50`,
      [req.params.id],
    );
    res.json({ messages: messages.rows });
  } catch (err) {
    console.error('Failed to load rediffpro messages:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load messages' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM rediffpro_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete rediffpro account:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete account' });
  }
});

export default router;
