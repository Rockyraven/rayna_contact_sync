# Rediffpro Inbox Directory Sync — Plan

## Goal
Extract From/To/Cc/Subject/Date from the Inbox of ~1000+ company mailboxes
(`name@raynab2b.com` / `name@raynatours.com`), hosted by rediffpro, currently
accessed via Outlook on each employee's desktop. Feeds into the same central
contact/email directory as the existing Gmail-linking feature.

This is being built for a client company. We don't hold rediffpro admin
credentials for their domain — access must come from the client's employees
or from rediffpro's own systems.

## Hard requirement (current blocker)
No rediffpro credential (password) should ever be entered into, or stored by,
this tool. If rediffpro has its own independent login UI (OAuth-style), that
must be what users interact with — this tool should only ever receive a
token, never a password.

## Existing infrastructure this builds on
- Backend: Node.js, `server/` (this repo)
- Database: Postgres on Neon
- Existing schema (from the separate Google Workspace feature already built):
  - `users` — app login via Google OAuth
  - `unified_contacts` — the CRM-style contact directory this feature also feeds
  - `linked_email_accounts` — encrypted Google OAuth refresh token per mailbox
  - `inbox_messages` — synced Gmail message headers
- That feature works because Google Workspace supports OAuth + domain-wide
  delegation + the Gmail API. Rediffpro is not Google Workspace and has no
  confirmed equivalent — whether the same zero-password architecture is
  possible depends entirely on what rediffpro's own systems support.

## What's blocking the final architecture decision
Need answers from rediffpro's technical/enterprise support team (not just
their self-service admin panel — already checked, no bulk/admin/impersonation
option there) — see `QUESTIONS_FOR_REDIFFPRO.md`.

Both a login mechanism AND a mail-reading mechanism are required together —
OAuth login alone only proves identity, it doesn't let us read mail.

## Path A — if rediffpro confirms OAuth + (Mail API or XOAUTH2 IMAP)
Mirrors the existing Gmail architecture:
1. User clicks "Add rediffpro account" in the tool.
2. Redirected to rediffpro's own hosted login page.
3. User logs in there directly — password never touches our system.
4. Rediffpro redirects back with an auth code; backend exchanges it for an
   access + refresh token.
5. New table (parallel to `linked_email_accounts`, but for rediffpro tokens)
   stores the token, encrypted.
6. Background sync job uses the token (Mail API or OAuth-IMAP) to pull Inbox
   headers into a new table (or a generalized version of `inbox_messages` —
   open design decision).
7. Weekly scheduled resync, fully automatic, no repeated employee action, no
   password ever stored.

## Path B — if rediffpro does NOT support this
The "zero credential" requirement is a hard provider limit, not a design gap.
Two fallback options, neither meets the zero-credential bar:

- **Self-service IMAP login**: employee types email + (ideally app-specific)
  password once; backend validates via IMAP and syncs headers. Simple UX, but
  a real password is entered and stored encrypted.
- **PST export/upload**: employee manually exports their Outlook Inbox to a
  `.pst` file and uploads it; backend parses it (e.g. `libratom` or `readpst`)
  to extract headers, then deletes the file immediately. No live credential
  ever touches the network, but heavier manual burden across 1000+ people.

## Data scope & privacy rules (settled, apply to any path)
- Only From, To, Cc, Subject, Date are ever extracted — never bodies or
  attachments.
- Bcc is not retrievable from Inbox messages by design (stripped before
  delivery) — only a Sent-copy would ever have it; don't plan around getting
  it from Inbox sync.
- Any credential or token that must be stored is stored encrypted, never in
  plaintext.
- If PST is ever used, the uploaded file is deleted from the server
  immediately after header extraction.

## Immediate next action
Contact rediffpro's support/technical team with the three questions in
`QUESTIONS_FOR_REDIFFPRO.md`. Their answer determines which path this project
takes.

## Build boundary
**Nothing gets built against the database or `server/` until rediffpro's
answer is known** — the schema and sync mechanism differ significantly
between Path A and Path B. Implementation, once unblocked, will live inside
`server/src/rediffpro/` and reuse this repo's existing Express app, DB pool,
and crypto helpers rather than a separate service.
