import 'dotenv/config';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const BACKFILL_LIMIT = 200;
// Gmail's per-user rate limit cares about request rate, not just volume —
// firing a full page of 100 detail fetches at once (Promise.all) reliably
// triggers a 429 on any inbox that isn't nearly empty. Capping concurrency
// keeps the request rate under that limit instead of bursting into it.
const DETAIL_FETCH_CONCURRENCY = 5;

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type MessageSummary = {
  id: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
};

export type MessageBatchHandler = (messages: MessageSummary[]) => Promise<void>;

// Gmail's From/To headers arrive as RFC 5322 mailboxes, e.g.
// `"Kellie Thornberry" <kellie.thornberry@bigpond.com>` or a bare
// `sabah@raynatours.com` with no display name. A header can list several
// comma-separated recipients; only the first is kept, matching what the
// single from/to display has always shown.
function parseAddress(header: string): { name: string; email: string } {
  const first = header.split(',')[0]?.trim() ?? '';
  const match = first.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: '', email: first };
}

export class GmailApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function exchangeAuthCode(serverAuthCode: string): Promise<string> {
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, '');
  const { tokens } = await client.getToken(serverAuthCode);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token; offline access must be requested');
  }
  return tokens.refresh_token;
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error('Failed to obtain a Gmail access token');
  }
  return token;
}

async function gmailGet(accessToken: string, path: string): Promise<any> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new GmailApiError(response.status, `Gmail API request failed with status ${response.status}`);
  }
  return response.json();
}

async function getMessageSummary(accessToken: string, id: string): Promise<MessageSummary> {
  const detail = await gmailGet(
    accessToken,
    `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To`,
  );
  const headers: { name: string; value: string }[] = detail.payload?.headers ?? [];
  const header = (name: string) => headers.find(h => h.name === name)?.value ?? '';
  const from = parseAddress(header('From'));
  const to = parseAddress(header('To'));
  return { id: detail.id, fromName: from.name, fromEmail: from.email, toName: to.name, toEmail: to.email };
}

export async function getCurrentHistoryId(accessToken: string): Promise<string> {
  const profile = await gmailGet(accessToken, '/profile');
  return profile.historyId;
}

// Calls onBatch after each page instead of accumulating everything and
// returning once at the end — a caller can persist each page immediately,
// so an interruption partway through (e.g. a rate limit) doesn't lose
// whatever was already fetched.
export async function fetchInboxBackfill(accessToken: string, onBatch: MessageBatchHandler): Promise<void> {
  let fetched = 0;
  let pageToken: string | undefined;
  do {
    const query = pageToken ? `&pageToken=${pageToken}` : '';
    const list = await gmailGet(accessToken, `/messages?labelIds=INBOX&maxResults=100${query}`);
    const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id);
    const details = await mapWithConcurrency(ids, DETAIL_FETCH_CONCURRENCY, id =>
      getMessageSummary(accessToken, id),
    );
    await onBatch(details);
    fetched += details.length;
    pageToken = list.nextPageToken;
  } while (pageToken && fetched < BACKFILL_LIMIT);
}

// Returns the latest historyId reached. If this throws partway through a
// multi-page pull, the caller still has whatever historyId was passed in —
// worse than an updated cursor, but no worse than before this call started.
export async function fetchInboxChanges(
  accessToken: string,
  startHistoryId: string,
  onBatch: MessageBatchHandler,
): Promise<string> {
  let latestHistoryId = startHistoryId;
  let pageToken: string | undefined;
  do {
    const query = pageToken ? `&pageToken=${pageToken}` : '';
    const history = await gmailGet(
      accessToken,
      `/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&labelId=INBOX${query}`,
    );
    const added: { message: { id: string } }[] = (history.history ?? []).flatMap(
      (h: { messagesAdded?: { message: { id: string } }[] }) => h.messagesAdded ?? [],
    );
    const details = await mapWithConcurrency(added, DETAIL_FETCH_CONCURRENCY, a =>
      getMessageSummary(accessToken, a.message.id),
    );
    await onBatch(details);
    if (history.historyId) {
      latestHistoryId = history.historyId;
    }
    pageToken = history.nextPageToken;
  } while (pageToken);
  return latestHistoryId;
}
