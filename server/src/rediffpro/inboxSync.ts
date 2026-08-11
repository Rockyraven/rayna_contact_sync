import pool from '../db';
import { decrypt } from '../crypto';
import { fetchInboxHeaders } from './imap';

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

  for (const header of headers) {
    await pool.query(
      `INSERT INTO rediffpro_messages
         (rediffpro_account_id, message_id, from_address, to_address, cc_address, subject, message_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (rediffpro_account_id, message_id)
       DO UPDATE SET from_address = $3, to_address = $4, cc_address = $5, subject = $6, message_date = $7`,
      [accountId, header.messageId, header.from, header.to, header.cc, header.subject, header.date],
    );
  }

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
