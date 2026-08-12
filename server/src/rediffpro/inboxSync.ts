import pool from '../db';
import { decrypt } from '../crypto';
import { fetchInboxHeaders, HeaderSummary } from './imap';

// One bulk upsert for the whole sync's worth of headers instead of one
// query per message.
async function upsertMessagesBatch(accountId: number, headers: HeaderSummary[]): Promise<void> {
  if (headers.length === 0) {
    return;
  }
  await pool.query(
    `INSERT INTO rediffpro_messages
       (rediffpro_account_id, message_id, from_address, to_address, cc_address, subject, message_date)
     SELECT $1, v.message_id, v.from_address, v.to_address, v.cc_address, v.subject, v.message_date
     FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[])
       AS v(message_id, from_address, to_address, cc_address, subject, message_date)
     ON CONFLICT (rediffpro_account_id, message_id)
     DO UPDATE SET from_address = EXCLUDED.from_address, to_address = EXCLUDED.to_address,
                   cc_address = EXCLUDED.cc_address, subject = EXCLUDED.subject,
                   message_date = EXCLUDED.message_date`,
    [
      accountId,
      headers.map(h => h.messageId),
      headers.map(h => h.from),
      headers.map(h => h.to),
      headers.map(h => h.cc),
      headers.map(h => h.subject),
      headers.map(h => h.date),
    ],
  );
}

export async function syncRediffproAccount(accountId: number): Promise<void> {
  const result = await pool.query(
    `SELECT email, password_encrypted, last_synced_at FROM rediffpro_accounts WHERE id = $1`,
    [accountId],
  );
  if (result.rows.length === 0) {
    return;
  }

  const { email, password_encrypted, last_synced_at } = result.rows[0];
  const password = decrypt(password_encrypted);
  const since = last_synced_at ? new Date(last_synced_at) : null;
  const headers = await fetchInboxHeaders(email, password, since);

  await upsertMessagesBatch(accountId, headers);

  await pool.query(`UPDATE rediffpro_accounts SET last_synced_at = now() WHERE id = $1`, [accountId]);
}

export async function syncAllRediffproAccounts(): Promise<void> {
  const result = await pool.query(`SELECT id FROM rediffpro_accounts`);
  for (const row of result.rows) {
    try {
      await syncRediffproAccount(row.id);
    } catch (err) {
      console.error(`Background rediffpro sync failed for account ${row.id}:`, err);
    }
  }
}
