import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { DeviceContact } from '../types';
import { parsePagination, parseSearch } from '../pagination';

const router = Router();

router.use(requireAuth);

type ContactRow = { email: string | null; mobile: string | null; name: string | null };

// Bulk-upserts a whole batch in 3 queries total (1 lookup + 1 update + 1
// insert) instead of up to 2 queries per contact. Matching is by mobile OR
// email against the existing table, same semantics the old per-contact loop
// had — just resolved for the whole batch at once instead of one row at a time.
async function upsertContactsBatch(userId: string, contacts: DeviceContact[]): Promise<number> {
  // Dedupe within this batch — last occurrence wins, mirroring how a
  // sequential loop would have had a later duplicate overwrite whatever an
  // earlier one in the same batch just wrote.
  const rows = new Map<string, ContactRow>();
  for (const contact of contacts) {
    const mobile = contact.phoneNumbers[0]?.number ?? null;
    const email = contact.emailAddresses[0]?.email ?? null;
    const name = contact.displayName ?? null;
    if (!mobile && !email) {
      continue;
    }
    rows.set(mobile ?? `email:${email}`, { mobile, email, name });
  }

  const deduped = [...rows.values()];
  if (deduped.length === 0) {
    return 0;
  }

  const existing = await pool.query(
    `SELECT id, mobile, email FROM unified_contacts
     WHERE user_id = $1 AND (mobile = ANY($2::text[]) OR email = ANY($3::text[]))`,
    [userId, deduped.map(r => r.mobile), deduped.map(r => r.email)],
  );

  const idByMobile = new Map<string, number>();
  const idByEmail = new Map<string, number>();
  for (const row of existing.rows) {
    if (row.mobile) idByMobile.set(row.mobile, row.id);
    if (row.email) idByEmail.set(row.email, row.id);
  }

  const toUpdate: (ContactRow & { id: number })[] = [];
  const toInsert: ContactRow[] = [];
  for (const row of deduped) {
    const matchedId = (row.mobile && idByMobile.get(row.mobile)) || (row.email && idByEmail.get(row.email));
    if (matchedId) {
      toUpdate.push({ ...row, id: matchedId });
    } else {
      toInsert.push(row);
    }
  }

  if (toUpdate.length > 0) {
    await pool.query(
      `UPDATE unified_contacts AS uc
       SET email = v.email, mobile = v.mobile, name = v.name, sources = 'mobile_app',
           synced_date = now(), updated_at = now()
       FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[]) AS v(id, email, mobile, name)
       WHERE uc.id = v.id`,
      [toUpdate.map(r => r.id), toUpdate.map(r => r.email), toUpdate.map(r => r.mobile), toUpdate.map(r => r.name)],
    );
  }

  if (toInsert.length > 0) {
    await pool.query(
      `INSERT INTO unified_contacts (user_id, email, mobile, name, sources, contact_type, synced_date, created_at, updated_at)
       SELECT $1, v.email, v.mobile, v.name, 'mobile_app', 'contact', now(), now(), now()
       FROM unnest($2::text[], $3::text[], $4::text[]) AS v(email, mobile, name)`,
      [userId, toInsert.map(r => r.email), toInsert.map(r => r.mobile), toInsert.map(r => r.name)],
    );
  }

  return deduped.length;
}

router.post('/sync', async (req, res) => {
  const { contacts } = req.body as { contacts?: DeviceContact[] };
  if (!Array.isArray(contacts)) {
    res.status(400).json({ error: 'contacts must be an array' });
    return;
  }
  if (contacts.length === 0) {
    res.json({ synced: 0 });
    return;
  }

  try {
    const synced = await upsertContactsBatch(req.userId!, contacts);
    res.json({ synced });
  } catch (err) {
    console.error('Contacts sync failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Contacts sync failed' });
  }
});

router.get('/', async (req, res) => {
  const search = parseSearch(req);
  const { page, pageSize, limit, offset } = parsePagination(req);
  try {
    const result = await pool.query(
      `SELECT id, email, mobile, name, sources, synced_date, created_at, updated_at,
              COUNT(*) OVER() AS total_count
       FROM unified_contacts
       WHERE user_id = $1
         AND (
           $2::text IS NULL
           OR name ILIKE '%' || $2 || '%'
           OR email ILIKE '%' || $2 || '%'
           OR mobile ILIKE '%' || $2 || '%'
         )
       ORDER BY synced_date DESC NULLS LAST, name ASC NULLS LAST
       LIMIT $3 OFFSET $4`,
      [req.userId, search, limit, offset],
    );
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const contacts = result.rows.map(({ total_count, ...rest }) => rest);
    res.json({ contacts, total, page, pageSize });
  } catch (err) {
    console.error('Failed to load contacts:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load contacts' });
  }
});

export default router;
