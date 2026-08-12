import { Router } from 'express';
import pool from '../db';
import { verifyGoogleIdToken, issueSessionToken, hashPassword, verifyPassword } from '../auth';

const router = Router();

const PUBLIC_USER_FIELDS = 'id, email, name, avatar_url, username, phone_number, role';

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

const PHONE_PATTERN = /^\+?[0-9()\-\s]{6,}$/;

type ClassifiedIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'username'; value: string };

function classifyIdentifier(raw: string): ClassifiedIdentifier {
  const trimmed = raw.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }
  if (PHONE_PATTERN.test(trimmed)) {
    return { kind: 'phone', value: trimmed };
  }
  return { kind: 'username', value: trimmed.toLowerCase() };
}

router.post('/google', async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(idToken);
  } catch (err) {
    console.error('Google token verification failed:', err);
    res.status(401).json({ error: 'Invalid Google token' });
    return;
  }

  if (!payload.email) {
    res.status(400).json({ error: 'Google account has no email' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id)
       DO UPDATE SET email = $2, name = $3, avatar_url = $4, updated_at = now()
       RETURNING id, email, name, avatar_url, role`,
      [payload.sub, payload.email, payload.name ?? null, payload.picture ?? null],
    );

    const user = result.rows[0];
    const token = issueSessionToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Failed to store Google sign-in:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed' });
  }
});

router.post('/register', async (req, res) => {
  const { name, identifier, password } = req.body as {
    name?: string;
    identifier?: string;
    password?: string;
  };

  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (!identifier || !identifier.trim()) {
    res.status(400).json({ error: 'Enter a username, email, or phone number' });
    return;
  }

  const classified = classifyIdentifier(identifier);
  const usernameValue = classified.kind === 'username' ? classified.value : null;
  const emailValue = classified.kind === 'email' ? classified.value : null;
  const phoneValue = classified.kind === 'phone' ? classified.value : null;

  try {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (name, username, email, phone_number, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PUBLIC_USER_FIELDS}`,
      [name ?? null, usernameValue, emailValue, phoneValue, passwordHash],
    );

    const user = result.rows[0];
    const token = issueSessionToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'That username, email, or phone number is already in use' });
      return;
    }
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  if (!identifier || !password) {
    res.status(400).json({ error: 'identifier and password are required' });
    return;
  }

  const normalized = normalizeIdentifier(identifier);

  try {
    const result = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS}, password_hash FROM users
       WHERE username = $1 OR email = $1 OR phone_number = $2
       LIMIT 1`,
      [normalized, identifier.trim()],
    );

    const row = result.rows[0];
    if (!row || !row.password_hash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { password_hash: _unused, ...user } = row;
    const token = issueSessionToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
