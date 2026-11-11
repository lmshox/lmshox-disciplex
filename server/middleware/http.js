import { ZodError } from 'zod';
import { RuleViolation } from '../services/engine.js';
import { resolveSession } from '../services/auth.js';

export const bearerToken = (req) => {
  const h = req.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
};

export const requireAuth = (db) => (req, res, next) => {
  const userId = resolveSession(db, bearerToken(req));
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
  req.userId = userId;
  next();
};

/** Small fixed-window limiter for auth endpoints (per IP). */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const key = req.ip;
    const n = (hits.get(key) ?? 0) + 1;
    hits.set(key, n);
    if (n > max) {
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again shortly.' } });
    }
    next();
  };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ error: { code: 'VALIDATION', message: issue?.message ?? 'Invalid input', field: issue?.path?.join('.') } });
  }
  if (err instanceof RuleViolation) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
}
