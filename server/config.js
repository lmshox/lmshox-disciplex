import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const int = (name, fallback) => {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
};

export const config = Object.freeze({
  port: int('PORT', 3001),
  isProd: process.env.NODE_ENV === 'production',
  dbPath: process.env.DB_PATH ?? path.join(root, 'data', 'disciplex.db'),
  clientDist: path.join(root, 'client', 'dist'),
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),
  evaluatorIntervalMs: int('EVALUATOR_INTERVAL_MS', 30_000),

  rules: Object.freeze({
    startingScore: 100,
    maxScore: 100,
    minScore: 0,
    failPenalty: int('FAIL_PENALTY', 10),
    completionReward: int('COMPLETION_REWARD', 2),
    // Strikes accumulated since the last accountability log that trigger a lockout.
    strikeThreshold: int('STRIKE_THRESHOLD', 3),
    // First lockout lasts this long; every subsequent lockout doubles, capped.
    lockoutBaseMinutes: int('LOCKOUT_BASE_MINUTES', 15),
    lockoutMaxMinutes: int('LOCKOUT_MAX_MINUTES', 24 * 60),
    accountabilityMinChars: 20,
  }),
});
