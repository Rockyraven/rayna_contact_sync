import pool from './db';
import { decrypt } from './crypto';
import {
  getAccessToken,
  getCurrentHistoryId,
  fetchInboxBackfill,
  fetchInboxChanges,
  mapWithConcurrency,
  GmailApiError,
  MessageSummary,
} from './gmail';

// Syncing accounts one at a time doesn't scale: at 1000+ linked accounts,
// even a fast per-account sync adds up to far longer than the 10-minute
// interval this runs on, so passes would perpetually fall behind. This caps
// how many accounts sync concurrently — independent from (and multiplied
// with) each account's own internal Gmail request concurrency, so the actual
// concurrent Gmail traffic across the whole project stays bounded and
// predictable rather than either fully serial or fully unbounded.
const ACCOUNT_SYNC_CONCURRENCY = 10;

// One bulk upsert per page instead of one query per message.
async function upsertMessagesBatch(accountId: number, messages: MessageSummary[]): Promise<void> {
  if (messages.length === 0) {
    return;
  }
  await pool.query(
    `INSERT INTO inbox_messages (linked_account_id, gmail_message_id, from_name, from_email, to_name, to_email)
     SELECT $1, v.id, v.from_name, v.from_email, v.to_name, v.to_email
     FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
       AS v(id, from_name, from_email, to_name, to_email)
     ON CONFLICT (linked_account_id, gmail_message_id)
     DO UPDATE SET from_name = EXCLUDED.from_name, from_email = EXCLUDED.from_email,
                   to_name = EXCLUDED.to_name, to_email = EXCLUDED.to_email`,
    [
      accountId,
      messages.map(m => m.id),
      messages.map(m => m.fromName),
      messages.map(m => m.fromEmail),
      messages.map(m => m.toName),
      messages.map(m => m.toEmail),
    ],
  );
}

// Derives one row per unique correspondent (sender or recipient) from a page
// of messages. A blank display name never overwrites a previously-seen one
// for the same address — later messages from the same sender don't always
// carry a display name, and losing it would be a regression, not a refresh.
//
// Deduped by email BEFORE the upsert, not left for ON CONFLICT to handle:
// every message's "to" is this same account's own address, so a page of
// more than one message would otherwise feed the same email into a single
// INSERT statement more than once — Postgres rejects an ON CONFLICT DO
// UPDATE that would touch the same row twice within one statement.
async function upsertContactsBatch(accountId: number, messages: MessageSummary[]): Promise<void> {
  const nameByEmail = new Map<string, string>();
  for (const m of messages) {
    if (m.fromEmail) {
      nameByEmail.set(m.fromEmail, m.fromName || nameByEmail.get(m.fromEmail) || '');
    }
    // Every recipient is its own correspondent — a message to 3 people is 3
    // entries here, not just its first "to" address.
    for (const recipient of m.toRecipients) {
      nameByEmail.set(recipient.email, recipient.name || nameByEmail.get(recipient.email) || '');
    }
  }
  if (nameByEmail.size === 0) {
    return;
  }
  const emails = [...nameByEmail.keys()];
  const names = emails.map(email => nameByEmail.get(email)!);
  await pool.query(
    `INSERT INTO inbox_contacts (linked_account_id, name, email, last_seen_at)
     SELECT $1, v.name, v.email, now()
     FROM unnest($2::text[], $3::text[]) AS v(name, email)
     ON CONFLICT (linked_account_id, email)
     DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), inbox_contacts.name), last_seen_at = now()`,
    [accountId, names, emails],
  );
}

async function setHistoryId(accountId: number, historyId: string): Promise<void> {
  await pool.query(`UPDATE linked_email_accounts SET history_id = $1 WHERE id = $2`, [historyId, accountId]);
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
  const accessToken = await getAccessToken(refreshToken);
  const onBatch = async (messages: MessageSummary[]) => {
    await upsertMessagesBatch(accountId, messages);
    await upsertContactsBatch(accountId, messages);
  };

  if (!history_id) {
    // Capture and persist the resume cursor BEFORE fetching any pages. If
    // the backfill gets interrupted partway (e.g. hits Gmail's rate limit,
    // which is exactly what happened before this fix), this cursor and
    // whatever pages already completed are still saved — the next attempt
    // does an incremental sync from here instead of restarting the entire
    // 200-message backfill from scratch, which is what caused repeat
    // full-backfill attempts to compound into a rate-limit spiral.
    // Trade-off: messages between wherever the backfill stopped and "now"
    // are permanently skipped, since incremental sync only looks forward.
    const historyId = await getCurrentHistoryId(accessToken);
    await setHistoryId(accountId, historyId);
    await fetchInboxBackfill(accessToken, onBatch);
  } else {
    try {
      const latestHistoryId = await fetchInboxChanges(accessToken, history_id, onBatch);
      await setHistoryId(accountId, latestHistoryId);
    } catch (err) {
      if (err instanceof GmailApiError && (err.status === 404 || err.status === 410)) {
        const historyId = await getCurrentHistoryId(accessToken);
        await setHistoryId(accountId, historyId);
        await fetchInboxBackfill(accessToken, onBatch);
      } else {
        throw err;
      }
    }
  }

  await pool.query(`UPDATE linked_email_accounts SET last_synced_at = now() WHERE id = $1`, [accountId]);
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
