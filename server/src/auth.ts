import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: string;
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const JWT_SECRET = process.env.JWT_SECRET ?? '';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Google token had no payload');
  }
  return payload;
}

export function issueSessionToken(user: {
  id: number | string;
  email?: string | null;
  role?: string | null;
}): string {
  return jwt.sign(
    { sub: String(user.id), email: user.email ?? null, role: user.role ?? 'MEMBER' },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    req.userId = payload.sub;
    req.userEmail = payload.email ?? undefined;
    req.userRole = payload.role ?? 'MEMBER';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role lives on the `users` table and travels in the JWT from sign-in —
// same trust model as email already had, not a live DB check per request.
// That means demoting an admin doesn't take effect until their token
// expires or they sign in again, not immediately.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
