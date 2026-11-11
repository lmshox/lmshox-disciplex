import { z } from 'zod';
import { config } from './config.js';
import { isValidTimezone } from './lib/time.js';

const trimmed = (min, max, label) =>
  z.string().trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`);

export const credentialsSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,32}$/, 'Username: 3–32 letters, digits, _ . -'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const registerSchema = credentialsSchema.extend({
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone'),
});

export const taskSchema = z.object({
  title: trimmed(1, 80, 'Title'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').default(''),
  deadlineTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Deadline must be HH:MM (24h)'),
  daysMask: z.number().int().min(1, 'Select at least one day').max(127),
});

const min = config.rules.accountabilityMinChars;
export const accountabilitySchema = z.object({
  failureSummary: trimmed(min, 1000, 'What happened'),
  rootCause: trimmed(min, 1000, 'Root cause'),
  correctiveAction: trimmed(min, 1000, 'Corrective action'),
});

export const idParam = z.coerce.number().int().positive();
