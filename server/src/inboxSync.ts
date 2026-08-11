import pool from './db';
import { decrypt } from './crypto';
import { syncInbox } from './gmail';

export async function syncLinkedAccount(accountId: number): Promise<void> {
  const result = await pool.query(
    `SELECT refresh_token_encrypted, history_id FROM linked_email_accounts WHERE id = $1`,
    [accountId],
  );
  if (result.rows.length === 0) {
    return;
  }

  const { refresh_token_encrypted, history_id } = result.rows[0];
  const refreshToken = decrypt(refresh_token_encrypted);
  const { messages, historyId } = await syncInbox(refreshToken, history_id ?? null);

  for (const message of messages) {
    await pool.query(
      `INSERT INTO inbox_messages (linked_account_id, gmail_message_id, from_address, to_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (linked_account_id, gmail_message_id)
       DO UPDATE SET from_address = $3, to_address = $4`,
      [accountId, message.id, message.from, message.to],
    );
  }

  await pool.query(
    `UPDATE linked_email_accounts SET history_id = $1, last_synced_at = now() WHERE id = $2`,
    [historyId, accountId],
  );
}

export async function syncAllLinkedAccounts(): Promise<void> {
  const result = await pool.query(`SELECT id FROM linked_email_accounts`);
  for (const row of result.rows) {
    try {
      await syncLinkedAccount(row.id);
    } catch (err) {
      console.error(`Background sync failed for linked account ${row.id}:`, err);
    }
  }
}
