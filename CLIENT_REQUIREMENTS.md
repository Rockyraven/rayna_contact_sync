# What to Request From Rayna Tours — and Why

Seven asks, each tied to a real blocker or risk in the project as it stands today.

## 1. A Google Cloud project created under a company (`@raynatours.com`) account
**Why:** The OAuth consent screen can only be set to "Internal" (unlimited signed-in users, no Google review, no test-user list) if the Cloud project belongs to their Workspace organization. The current project is owned by a personal Gmail account, so it almost certainly has no organization attached — Internal mode won't even be selectable until this is fixed.

## 2. Confirmation that `raynatours.com` is an active Google Workspace domain
**Why:** Internal mode strictly requires it. This is worth getting an explicit yes on *before* building anything further around it — if they're not actually on Workspace, the "no user limit" plan doesn't work at all, and the fallback (Google's public app verification process for External/Production) is a slower, heavier path you'd want to plan for instead.

## 3. Project access (Owner or Editor role) for you, granted from a company account
**Why:** So you can configure the OAuth consent screen, enable the Gmail API, and create/rotate the OAuth Client ID and Secret — without any of it being tied to your personal Gmail account. This is also basic project hygiene: the client should own the credentials their own employees authenticate through.

## 4. Named company admin email(s) for in-app admin access
**Why:** The admin view exposes every employee's synced contacts and every linked Gmail account's contact list across the whole company. That access should be tied to an accountable person inside Rayna Tours, not to your personal `rocky.86agency@gmail.com` — get them to tell you who, by name and company email.

## 5. Written sign-off that employees will be told what linking a Gmail account does
**Why:** Linking exposes that inbox's From/To addresses to company admins. This is employee data, and it should be the client's informed decision — not something that surfaces later as "we didn't know this was happening." A short line of sign-off protects you both.

## 6. A decision on who owns production infrastructure
**Why:** The database, server, and admin web app currently exist only in local dev, running against a Postgres instance that isn't clearly owned by the client. For a real handover, they should either take ownership of hosting/billing or explicitly approve it staying on infrastructure you control — an unstated default here becomes a real problem later (who pays, who has access, what happens if you're unreachable).

## 7. A retention policy for stored inbox contact data
**Why:** Every linked account's From/To data is stored indefinitely today, with no deletion logic. How long to keep it, and whether it should ever be purged, is a business/compliance call — it shouldn't be left as an unexamined default.

---

**The pattern across all seven:** none of this is a technical decision you should be making unilaterally on the client's behalf. Each one is either an access/ownership question (so the client controls their own OAuth identity, infrastructure, and admin access) or a disclosure question (so employees aren't surprised by what the app collects). Getting explicit answers now is cheaper than unwinding an assumption later.
