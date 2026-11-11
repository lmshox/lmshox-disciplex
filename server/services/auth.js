import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { RuleViolation } from './engine.js';

const scrypt = promisify(crypto.scrypt);
const KEYLEN = 64;
const DAY = 86_400_000;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(db, userId, now = Date.now()) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, now, now + config.sessionTtlDays * DAY);
  return token;
}

export function resolveSession(db, token, now = Date.now()) {
  if (!token) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(sha256(token));
  if (!row || row.expires_at <= now) return null;
  return row.user_id;
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function purgeExpiredSessions(db, now = Date.now()) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}

export async function register(db, { username, password, timezone }, now = Date.now()) {
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    throw new RuleViolation(409, 'USERNAME_TAKEN', 'That username is already taken.');
  }
  const hash = await hashPassword(password);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, timezone, score, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, hash, timezone, config.rules.startingScore, now);
  const userId = Number(lastInsertRowid);
  return { userId, token: createSession(db, userId, now) };
}

// Constant-time-ish failure path: always run scrypt so timing doesn't reveal valid usernames.
const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString('hex'));

export async function login(db, { username, password }, now = Date.now()) {
  const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username);
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new RuleViolation(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  return { userId: user.id, token: createSession(db, user.id, now) };
}
