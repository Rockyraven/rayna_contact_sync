import pool from './db';

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password-based accounts don't have a google_id, and may sign up with only
-- a username or phone number, so email can no longer be mandatory either.
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS unified_contacts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  mobile TEXT,
  name TEXT,
  country TEXT,
  city TEXT,
  sources TEXT,
  contact_type TEXT,
  wa_unsubscribe TEXT,
  email_unsubscribe TEXT,
  booking_status TEXT,
  product_tier TEXT,
  geography TEXT,
  is_indian BOOLEAN,
  segments TEXT,
  synced_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actual_email TEXT,
  actual_mobile TEXT,
  mobile_country TEXT
);

CREATE INDEX IF NOT EXISTS unified_contacts_user_id_idx ON unified_contacts(user_id);
CREATE INDEX IF NOT EXISTS unified_contacts_user_mobile_idx ON unified_contacts(user_id, mobile);
CREATE INDEX IF NOT EXISTS unified_contacts_user_email_idx ON unified_contacts(user_id, email);

CREATE TABLE IF NOT EXISTS linked_email_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

ALTER TABLE linked_email_accounts ADD COLUMN IF NOT EXISTS history_id TEXT;
ALTER TABLE linked_email_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS linked_email_accounts_user_id_idx ON linked_email_accounts(user_id);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id BIGSERIAL PRIMARY KEY,
  linked_account_id BIGINT NOT NULL REFERENCES linked_email_accounts(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (linked_account_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS inbox_messages_linked_account_id_idx ON inbox_messages(linked_account_id);

CREATE TABLE IF NOT EXISTS rediffpro_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS rediffpro_accounts_user_id_idx ON rediffpro_accounts(user_id);

CREATE TABLE IF NOT EXISTS rediffpro_messages (
  id BIGSERIAL PRIMARY KEY,
  rediffpro_account_id BIGINT NOT NULL REFERENCES rediffpro_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  cc_address TEXT,
  subject TEXT,
  message_date TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rediffpro_account_id, message_id)
);

CREATE INDEX IF NOT EXISTS rediffpro_messages_account_id_idx ON rediffpro_messages(rediffpro_account_id);
`;

async function migrate() {
  await pool.query(SQL);
  console.log(
    'Migration complete: users, unified_contacts, linked_email_accounts, inbox_messages, rediffpro_accounts, rediffpro_messages',
  );
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
