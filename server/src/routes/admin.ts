import { Router } from 'express';
import pool from '../db';
import { requireAuth, requireAdmin } from '../auth';
import { syncLinkedAccount } from '../inboxSync';
import { parsePagination, parseSearch } from '../pagination';

const router = Router();

router.use(requireAuth, requireAdmin);

// Per-user summary for the dashboard's landing table. Uses pre-aggregated
// subqueries rather than joining unified_contacts and linked_email_accounts
// directly on users — a direct join fans out into a cross product per user
// (e.g. 3 contacts x 2 linked accounts = 6 rows before aggregation), which
// silently inflates COUNT/MAX unless carefully deduped. Aggregating each
// side first avoids that entirely. Not paginated: at one row per user this
// stays reasonable even at 1000+ users, unlike the per-contact/per-message
// tables below.
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.username, u.phone_number, u.role, u.created_at,
         COALESCE(c.contact_count, 0) AS contact_count,
         c.last_synced AS contacts_last_synced,
         COALESCE(e.email_count, 0) AS linked_email_count,
         e.last_synced AS email_last_synced
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS contact_count, MAX(synced_date) AS last_synced
         FROM unified_contacts GROUP BY user_id
       ) c ON c.user_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS email_count, MAX(last_synced_at) AS last_synced
         FROM linked_email_accounts GROUP BY user_id
       ) e ON e.user_id = u.id
       ORDER BY u.created_at DESC`,
    );
    // COUNT(*) is bigint, which node-postgres returns as a string — left
    // as-is, summing these client-side (dashboard totals) silently
    // concatenates instead of adding (0 + "10" + "42" -> "01042").
    const users = result.rows.map(row => ({
      ...row,
      contact_count: Number(row.contact_count),
      linked_email_count: Number(row.linked_email_count),
    }));
    res.json({ users });
  } catch (err) {
    console.error('Failed to load admin users overview:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load users' });
  }
});

router.get('/contacts', async (req, res) => {
  const { user_id: userId } = req.query as { user_id?: string };
  const search = parseSearch(req);
  const { page, pageSize, limit, offset } = parsePagination(req);
  try {
    const result = await pool.query(
      `SELECT uc.id, uc.name, uc.email, uc.mobile, uc.sources, uc.synced_date, uc.created_at,
              u.email AS owner_email, u.name AS owner_name,
              COUNT(*) OVER() AS total_count
       FROM unified_contacts uc
       JOIN users u ON u.id = uc.user_id
       WHERE ($1::bigint IS NULL OR uc.user_id = $1::bigint)
         AND (
           $2::text IS NULL
           OR uc.name ILIKE '%' || $2 || '%'
           OR uc.email ILIKE '%' || $2 || '%'
           OR uc.mobile ILIKE '%' || $2 || '%'
         )
       ORDER BY uc.synced_date DESC NULLS LAST, uc.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId ?? null, search, limit, offset],
    );
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const contacts = result.rows.map(({ total_count, ...rest }) => rest);
    res.json({ contacts, total, page, pageSize });
  } catch (err) {
    console.error('Failed to load admin contacts:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load contacts' });
  }
});

router.get('/email-accounts', async (req, res) => {
  const { user_id: userId } = req.query as { user_id?: string };
  const search = parseSearch(req);
  const { page, pageSize, limit, offset } = parsePagination(req);
  try {
    const result = await pool.query(
      `SELECT lea.id, lea.email, lea.created_at, lea.last_synced_at, lea.history_id,
              u.email AS owner_email, u.name AS owner_name,
              COUNT(*) OVER() AS total_count
       FROM linked_email_accounts lea
       JOIN users u ON u.id = lea.user_id
       WHERE ($1::bigint IS NULL OR lea.user_id = $1::bigint)
         AND (
           $2::text IS NULL
           OR lea.email ILIKE '%' || $2 || '%'
           OR u.email ILIKE '%' || $2 || '%'
           OR u.name ILIKE '%' || $2 || '%'
         )
       ORDER BY lea.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId ?? null, search, limit, offset],
    );
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const accounts = result.rows.map(({ total_count, ...rest }) => rest);
    res.json({ accounts, total, page, pageSize });
  } catch (err) {
    console.error('Failed to load admin email accounts:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load email accounts' });
  }
});

router.get('/email-accounts/:id/messages', async (req, res) => {
  const search = parseSearch(req);
  const { page, pageSize, limit, offset } = parsePagination(req);
  try {
    const account = await pool.query(
      `SELECT email FROM linked_email_accounts WHERE id = $1`,
      [req.params.id],
    );
    if (account.rows.length === 0) {
      res.status(404).json({ error: 'Linked account not found' });
      return;
    }

    let syncError: string | null = null;
    try {
      await syncLinkedAccount(Number(req.params.id));
    } catch (err) {
      console.error('Inbox sync failed (admin):', err);
      syncError = err instanceof Error ? err.message : String(err);
    }

    const contacts = await pool.query(
      `SELECT id, name, email, last_seen_at, COUNT(*) OVER() AS total_count
       FROM inbox_contacts
       WHERE linked_account_id = $1
         AND (
           $2::text IS NULL
           OR name ILIKE '%' || $2 || '%'
           OR email ILIKE '%' || $2 || '%'
         )
       ORDER BY last_seen_at DESC
       LIMIT $3 OFFSET $4`,
      [req.params.id, search, limit, offset],
    );
    const total = contacts.rows.length > 0 ? Number(contacts.rows[0].total_count) : 0;
    const rows = contacts.rows.map(({ total_count, ...rest }) => rest);
    res.json({ email: account.rows[0].email, sync_error: syncError, messages: rows, total, page, pageSize });
  } catch (err) {
    console.error('Failed to load admin inbox messages:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load messages' });
  }
});

export default router;
