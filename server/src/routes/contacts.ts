import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { DeviceContact } from '../types';

const router = Router();

router.use(requireAuth);

async function upsertContact(userId: string, contact: DeviceContact) {
  const mobile = contact.phoneNumbers[0]?.number ?? null;
  const email = contact.emailAddresses[0]?.email ?? null;
  const name = contact.displayName ?? null;

  const existing = await pool.query(
    `SELECT id FROM unified_contacts
     WHERE user_id = $1
       AND ((mobile IS NOT NULL AND mobile = $2) OR (email IS NOT NULL AND email = $3))
     LIMIT 1`,
    [userId, mobile, email],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE unified_contacts
       SET email = $1, mobile = $2, name = $3, sources = 'mobile_app',
           synced_date = now(), updated_at = now()
       WHERE id = $4`,
      [email, mobile, name, existing.rows[0].id],
    );
    return;
  }

  await pool.query(
    `INSERT INTO unified_contacts
       (user_id, email, mobile, name, sources, contact_type, synced_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'mobile_app', 'contact', now(), now(), now())`,
    [userId, email, mobile, name],
  );
}

router.post('/sync', async (req, res) => {
  const { contacts } = req.body as { contacts?: DeviceContact[] };
  if (!Array.isArray(contacts)) {
    res.status(400).json({ error: 'contacts must be an array' });
    return;
  }

  const userId = req.userId!;
  for (const contact of contacts) {
    await upsertContact(userId, contact);
  }

  res.json({ synced: contacts.length });
});

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT id, email, mobile, name, sources, synced_date, created_at, updated_at
     FROM unified_contacts
     WHERE user_id = $1
     ORDER BY name ASC NULLS LAST`,
    [req.userId],
  );
  res.json({ contacts: result.rows });
});

export default router;
