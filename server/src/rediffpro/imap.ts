import 'dotenv/config';
import { ImapFlow, MessageAddressObject } from 'imapflow';

const IMAP_HOST = process.env.REDIFFPRO_IMAP_HOST ?? 'imap.rediffmailpro.com';
const IMAP_PORT = Number(process.env.REDIFFPRO_IMAP_PORT ?? 993);
const IMAP_SECURE = (process.env.REDIFFPRO_IMAP_SECURE ?? 'true') === 'true';
const BACKFILL_LIMIT = 200;

export type HeaderSummary = {
  messageId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: Date | null;
};

function formatAddresses(addresses?: MessageAddressObject[]): string {
  if (!addresses || addresses.length === 0) {
    return '';
  }
  return addresses
    .map(a => (a.name ? `"${a.name}" <${a.address ?? ''}>` : (a.address ?? '')))
    .join(', ');
}

function connect(email: string, password: string): ImapFlow {
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: email, pass: password },
    logger: false,
  });
}

export async function verifyImapLogin(email: string, password: string): Promise<void> {
  const client = connect(email, password);
  await client.connect();
  await client.logout();
}

export async function fetchInboxHeaders(
  email: string,
  password: string,
  since: Date | null,
): Promise<HeaderSummary[]> {
  const client = connect(email, password);
  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const searchResult = await client.search(since ? { since } : { all: true }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const targetUids = since ? uids : uids.slice(-BACKFILL_LIMIT);

      if (targetUids.length === 0) {
        return [];
      }

      const headers: HeaderSummary[] = [];
      for await (const message of client.fetch(targetUids, { envelope: true }, { uid: true })) {
        const envelope = message.envelope;
        if (!envelope?.messageId) {
          continue;
        }
        headers.push({
          messageId: envelope.messageId,
          from: formatAddresses(envelope.from),
          to: formatAddresses(envelope.to),
          cc: formatAddresses(envelope.cc),
          subject: envelope.subject ?? '',
          date: envelope.date ?? null,
        });
      }
      return headers;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
