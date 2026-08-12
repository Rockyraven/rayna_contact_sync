import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { encrypt } from '../crypto';
import { exchangeAuthCode } from '../gmail';
import { syncLinkedAccount } from '../inboxSync';

const router = Router();

router.use(requireAuth);

router.post('/link', async (req, res) => {
  const { serverAuthCode, email } = req.body as { serverAuthCode?: string; email?: string };
  if (!serverAuthCode || !email) {
    res.status(400).json({ error: 'serverAuthCode and email are required' });
    return;
  }

  try {
    const refreshToken = await exchangeAuthCode(serverAuthCode);
    const encrypted = encrypt(refreshToken);

    await pool.query(
      `INSERT INTO linked_email_accounts (user_id, email, refresh_token_encrypted)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, email)
       DO UPDATE SET refresh_token_encrypted = $3, updated_at = now()`,
      [req.userId, email, encrypted],
    );

    res.json({ email });
  } catch (err) {
    console.error('Failed to link email account:', err);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to link account' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, created_at, last_synced_at
       FROM linked_email_accounts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId],
    );
    res.json({ accounts: result.rows });
  } catch (err) {
    console.error('Failed to load linked accounts:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load linked accounts' });
  }
});

router.post('/:id/resync', async (req, res) => {
  try {
    const account = await pool.query(
      `SELECT id FROM linked_email_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    if (account.rows.length === 0) {
      res.status(404).json({ error: 'Linked account not found' });
      return;
    }

    await syncLinkedAccount(Number(req.params.id));

    const updated = await pool.query(
      `SELECT last_synced_at FROM linked_email_accounts WHERE id = $1`,
      [req.params.id],
    );
    res.json({ last_synced_at: updated.rows[0].last_synced_at });
  } catch (err) {
    console.error('Manual resync failed:', err);
    res.status(502).json({ error: err instanceof Error ? err.message : 'Resync failed' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const account = await pool.query(
      `SELECT id FROM linked_email_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    if (account.rows.length === 0) {
      res.status(404).json({ error: 'Linked account not found' });
      return;
    }

    // Best-effort: still return whatever's already stored even if the live
    // sync fails, but say so — a silent 200 here is what made the earlier
    // "why isn't this syncing" investigation impossible to debug from the
    // API alone.
    let syncError: string | null = null;
    try {
      await syncLinkedAccount(Number(req.params.id));
    } catch (err) {
      console.error('Inbox sync failed:', err);
      syncError = err instanceof Error ? err.message : String(err);
    }

    const messages = await pool.query(
      `SELECT gmail_message_id AS id, from_address AS "from", to_address AS "to"
       FROM inbox_messages
       WHERE linked_account_id = $1
       ORDER BY id DESC
       LIMIT 50`,
      [req.params.id],
    );
    res.json({ sync_error: syncError, messages: messages.rows });
  } catch (err) {
    console.error('Failed to load inbox messages:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load inbox messages' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM linked_email_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete linked account:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete linked account' });
  }
});

export default router;
