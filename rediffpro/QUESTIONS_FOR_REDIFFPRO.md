# Questions for Rediffpro Technical/Enterprise Support

We're building an internal tool that needs to read Inbox headers (sender,
recipient, subject, date — never body or attachments) across our
organization's mailboxes. We will not ask employees to give us their
rediffpro password under any circumstances, so we need to know what
authentication options your platform actually supports at the API/protocol
level — not just the self-service admin panel, which we've already checked
and doesn't expose a bulk/admin/impersonation option.

1. Do you support OAuth 2.0 authorization code flow for third-party apps —
   where a user is redirected to your hosted login page, logs in there
   directly, and our app receives only an access/refresh token, never the
   password?

2. If yes to #1 — is there a Mail API we can call with that token to read a
   user's Inbox messages (sender, recipient, subject, date)?

3. Alternatively, does your IMAP server support XOAUTH2/OAUTHBEARER
   authentication, so the same OAuth token can open an IMAP session in place
   of a password?

We need a "yes" to #1 together with a "yes" to either #2 or #3 for a
zero-password integration to be possible. If none of these are supported,
we'll need to know that explicitly so we can plan around it.
