import pool from './db';
import { decrypt } from './crypto';
import { syncInbox, MessageSummary, mapWithConcurrency } from './gmail';

// Syncing accounts one at a time doesn't scale: at 1000+ linked accounts,
// even a fast per-account sync adds up to far longer than the 10-minute
// interval this runs on, so passes would perpetually fall behind. This caps
// how many accounts sync concurrently — independent from (and multiplied
// with) each account's own internal Gmail request concurrency, so the actual
// concurrent Gmail traffic across the whole project stays bounded and
// predictable rather than either fully serial or fully unbounded.
const ACCOUNT_SYNC_CONCURRENCY = 10;

// One bulk upsert for the whole sync's worth of messages instead of one
// query per message — a 200-message backfill was 200 round trips before.
async function upsertMessagesBatch(accountId: number, messages: MessageSummary[]): Promise<void> {
  if (messages.length === 0) {
    return;
  }
  await pool.query(
    `INSERT INTO inbox_messages (linked_account_id, gmail_message_id, from_address, to_address)
     SELECT $1, v.id, v.from_address, v.to_address
     FROM unnest($2::text[], $3::text[], $4::text[]) AS v(id, from_address, to_address)
     ON CONFLICT (linked_account_id, gmail_message_id)
     DO UPDATE SET from_address = EXCLUDED.from_address, to_address = EXCLUDED.to_address`,
    [accountId, messages.map(m => m.id), messages.map(m => m.from), messages.map(m => m.to)],
  );
}

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

  await upsertMessagesBatch(accountId, messages);

  await pool.query(
    `UPDATE linked_email_accounts SET history_id = $1, last_synced_at = now() WHERE id = $2`,
    [historyId, accountId],
  );
}

export async function syncAllLinkedAccounts(): Promise<void> {
  const result = await pool.query(`SELECT id FROM linked_email_accounts`);
  await mapWithConcurrency(result.rows, ACCOUNT_SYNC_CONCURRENCY, async row => {
    try {
      await syncLinkedAccount(row.id);
    } catch (err) {
      console.error(`Background sync failed for linked account ${row.id}:`, err);
    }
  });
}
