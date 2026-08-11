import { Router } from 'express';
import pool from '../db';
import { syncLinkedAccount } from '../inboxSync';

const router = Router();

// TEMPORARY: admin auth disabled for local testing. This exposes every
// employee's contacts and inbox metadata with no access control — re-enable
// `requireAuth, requireAdmin` (from '../auth') before this runs anywhere but localhost.

router.get('/contacts', async (req, res) => {
  const result = await pool.query(
    `SELECT uc.id, uc.name, uc.email, uc.mobile, uc.sources, uc.synced_date, uc.created_at,
            u.email AS owner_email, u.name AS owner_name
     FROM unified_contacts uc
     JOIN users u ON u.id = uc.user_id
     ORDER BY uc.synced_date DESC NULLS LAST, uc.created_at DESC`,
  );
  res.json({ contacts: result.rows });
});

router.get('/email-accounts', async (req, res) => {
  const result = await pool.query(
    `SELECT lea.id, lea.email, lea.created_at,
            u.email AS owner_email, u.name AS owner_name
     FROM linked_email_accounts lea
     JOIN users u ON u.id = lea.user_id
     ORDER BY lea.created_at DESC`,
  );
  res.json({ accounts: result.rows });
});

router.get('/email-accounts/:id/messages', async (req, res) => {
  const account = await pool.query(
    `SELECT email FROM linked_email_accounts WHERE id = $1`,
    [req.params.id],
  );
  if (account.rows.length === 0) {
    res.status(404).json({ error: 'Linked account not found' });
    return;
  }

  try {
    await syncLinkedAccount(Number(req.params.id));
  } catch (err) {
    console.error('Inbox sync failed (admin):', err);
  }

  const messages = await pool.query(
    `SELECT gmail_message_id AS id, from_address AS "from", to_address AS "to"
     FROM inbox_messages
     WHERE linked_account_id = $1
     ORDER BY id DESC
     LIMIT 50`,
    [req.params.id],
  );
  res.json({ email: account.rows[0].email, messages: messages.rows });
});

export default router;
