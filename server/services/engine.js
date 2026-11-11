/**
 * Discipline engine: the single source of truth for scheduling, deadlines,
 * penalties, lockouts and metrics. Every function takes an explicit `now`
 * (epoch ms) so behaviour is deterministic and testable.
 *
 * The server clock is the judge. Clients can never set completion times.
 */
import { config } from '../config.js';
import { transaction } from '../db.js';
import { addDays, localDate, startOfLocalDay, weekdayOf, zonedToUtc } from '../lib/time.js';

const R = config.rules;
const MAX_BACKFILL_DAYS = 366;
const MINUTE = 60_000;

export class RuleViolation extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getUser(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new RuleViolation(404, 'USER_NOT_FOUND', 'User not found');
  return user;
}

function logEvent(db, { userId, type, delta = 0, message, instanceId = null, at }) {
  db.prepare(
    `INSERT INTO events (user_id, type, score_delta, message, instance_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(userId, type, delta, message, instanceId, at);
}

/** Applies a score change clamped to [min, max]; returns the delta actually applied. */
function applyScore(db, user, requested) {
  const next = Math.max(R.minScore, Math.min(R.maxScore, user.score + requested));
  const delta = next - user.score;
  if (delta !== 0) {
    db.prepare('UPDATE users SET score = ? WHERE id = ?').run(next, user.id);
    user.score = next;
  }
  return delta;
}

export function lockoutMinutesFor(lockoutCount) {
  return Math.min(R.lockoutMaxMinutes, R.lockoutBaseMinutes * 2 ** lockoutCount);
}

export function isScheduledOn(daysMask, dateStr) {
  return (daysMask & (1 << weekdayOf(dateStr))) !== 0;
}

// ---------------------------------------------------------------------------
// Evaluation pipeline
// ---------------------------------------------------------------------------

/**
 * Materialises task occurrences for every local day from the last generated
 * date up to today. A task only gets an occurrence on a day if it existed
 * before that day's deadline and was not archived before the day began.
 */
function generateInstances(db, user, now) {
  const tz = user.timezone;
  const today = localDate(now, tz);
  let date = user.last_generated_date ?? localDate(user.created_at, tz);
  const earliest = addDays(today, -MAX_BACKFILL_DAYS);
  if (date < earliest) date = earliest;

  const tasks = db
    .prepare('SELECT * FROM tasks WHERE user_id = ? AND (archived_at IS NULL OR archived_at > ?)')
    .all(user.id, startOfLocalDay(date, tz));
  if (tasks.length) {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO instances (task_id, user_id, date, title, deadline_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (; date <= today; date = addDays(date, 1)) {
      const dayStart = startOfLocalDay(date, tz);
      for (const task of tasks) {
        if (task.archived_at !== null && task.archived_at <= dayStart) continue;
        if (!isScheduledOn(task.days_mask, date)) continue;
        const deadline = zonedToUtc(date, task.deadline_time, tz);
        if (task.created_at < deadline) insert.run(task.id, user.id, date, task.title, deadline);
      }
    }
  }
  if (user.last_generated_date !== today) {
    db.prepare('UPDATE users SET last_generated_date = ? WHERE id = ?').run(today, user.id);
    user.last_generated_date = today;
  }
}

/** Flags every pending occurrence whose deadline has passed as FAILED. */
function failOverdue(db, user, now) {
  const overdue = db
    .prepare(
      `SELECT id, title, deadline_at FROM instances
       WHERE user_id = ? AND status = 'pending' AND deadline_at <= ?
       ORDER BY deadline_at`,
    )
    .all(user.id, now);

  const mark = db.prepare(`UPDATE instances SET status = 'failed', resolved_at = ? WHERE id = ?`);
  for (const inst of overdue) {
    mark.run(inst.deadline_at, inst.id);
    const delta = applyScore(db, user, -R.failPenalty);
    user.strike_count += 1;
    logEvent(db, {
      userId: user.id,
      type: 'failed',
      delta,
      message: `FAILED: "${inst.title}" — deadline missed. Strike #${user.strike_count}.`,
      instanceId: inst.id,
      at: inst.deadline_at,
    });
  }
  if (overdue.length) {
    db.prepare('UPDATE users SET strike_count = ? WHERE id = ?').run(user.strike_count, user.id);
  }
  return overdue.length;
}

/** Engages a lockout once strikes since the last accountability log reach the threshold. */
function enforceThreshold(db, user, now) {
  const inCycle = user.strike_count - user.strikes_at_reset;
  if (inCycle < R.strikeThreshold || user.accountability_required) return;

  const minutes = lockoutMinutesFor(user.lockout_count);
  user.locked_until = now + minutes * MINUTE;
  user.lockout_count += 1;
  user.accountability_required = 1;
  db.prepare(
    `UPDATE users SET locked_until = ?, lockout_count = ?, accountability_required = 1 WHERE id = ?`,
  ).run(user.locked_until, user.lockout_count, user.id);
  logEvent(db, {
    userId: user.id,
    type: 'lockout',
    message: `LOCKOUT #${user.lockout_count}: ${inCycle} strikes reached. System locked for ${minutes} min.`,
    at: now,
  });
}

/** Brings a user's state fully up to date. Idempotent; safe to call on every request. */
export function evaluateUser(db, userId, now = Date.now()) {
  return transaction(db, () => {
    const user = getUser(db, userId);
    generateInstances(db, user, now);
    failOverdue(db, user, now);
    enforceThreshold(db, user, now);
    return user;
  });
}

export function evaluateAll(db, now = Date.now()) {
  const ids = db.prepare('SELECT id FROM users').all().map((r) => r.id);
  for (const id of ids) evaluateUser(db, id, now);
  return ids.length;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function assertCanModifyTasks(user, now) {
  if (user.accountability_required) {
    const locked = user.locked_until !== null && now < user.locked_until;
    throw new RuleViolation(
      423,
      locked ? 'LOCKED_OUT' : 'ACCOUNTABILITY_REQUIRED',
      locked
        ? 'System lockout in effect. Task changes are disabled.'
        : 'Submit your accountability log before changing tasks.',
    );
  }
}

export function createTask(db, userId, input, now = Date.now()) {
  return transaction(db, () => {
    const user = evaluateUser(db, userId, now);
    assertCanModifyTasks(user, now);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO tasks (user_id, title, description, days_mask, deadline_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, input.title, input.description, input.daysMask, input.deadlineTime, now, now);
    logEvent(db, { userId, type: 'task_created', message: `Task created: "${input.title}" (due ${input.deadlineTime}).`, at: now });
    evaluateUser(db, userId, now); // materialise today's occurrence if still in play
    return Number(lastInsertRowid);
  });
}

/**
 * Edits take effect from the next generated occurrence. Occurrences already
 * in play keep their frozen title and deadline.
 */
export function updateTask(db, userId, taskId, input, now = Date.now()) {
  return transaction(db, () => {
    const user = evaluateUser(db, userId, now);
    assertCanModifyTasks(user, now);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ? AND archived_at IS NULL').get(taskId, userId);
    if (!task) throw new RuleViolation(404, 'TASK_NOT_FOUND', 'Task not found');
    db.prepare(
      `UPDATE tasks SET title = ?, description = ?, days_mask = ?, deadline_time = ?, updated_at = ? WHERE id = ?`,
    ).run(input.title, input.description, input.daysMask, input.deadlineTime, now, taskId);
    evaluateUser(db, userId, now);
  });
}

/** Archiving stops future occurrences. Today's occurrence (if any) still counts. */
export function archiveTask(db, userId, taskId, now = Date.now()) {
  return transaction(db, () => {
    const user = evaluateUser(db, userId, now);
    assertCanModifyTasks(user, now);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ? AND archived_at IS NULL').get(taskId, userId);
    if (!task) throw new RuleViolation(404, 'TASK_NOT_FOUND', 'Task not found');
    db.prepare('UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, taskId);
    logEvent(db, { userId, type: 'task_archived', message: `Task archived: "${task.title}".`, at: now });
  });
}

/** Marks an occurrence done. Completion is final and judged by the server clock. */
export function completeInstance(db, userId, instanceId, now = Date.now()) {
  return transaction(db, () => {
    const user = evaluateUser(db, userId, now);
    const inst = db.prepare('SELECT * FROM instances WHERE id = ? AND user_id = ?').get(instanceId, userId);
    if (!inst) throw new RuleViolation(404, 'INSTANCE_NOT_FOUND', 'Task occurrence not found');
    if (inst.status === 'done') return { alreadyDone: true };
    if (inst.status === 'failed') {
      throw new RuleViolation(409, 'DEADLINE_PASSED', 'Deadline already passed. This task is FAILED.');
    }
    db.prepare(`UPDATE instances SET status = 'done', resolved_at = ? WHERE id = ?`).run(now, inst.id);
    const delta = applyScore(db, user, R.completionReward);
    logEvent(db, {
      userId,
      type: 'completed',
      delta,
      message: `Completed "${inst.title}"${delta ? ` (+${delta})` : ''}.`,
      instanceId: inst.id,
      at: now,
    });
    return { alreadyDone: false };
  });
}

export function submitAccountability(db, userId, input, now = Date.now()) {
  return transaction(db, () => {
    const user = evaluateUser(db, userId, now);
    if (!user.accountability_required) {
      throw new RuleViolation(409, 'NOT_REQUIRED', 'No accountability log is currently required.');
    }
    if (user.locked_until !== null && now < user.locked_until) {
      throw new RuleViolation(423, 'LOCKED_OUT', 'Lockout still in effect. Wait for the timer to expire.');
    }
    const inCycle = user.strike_count - user.strikes_at_reset;
    db.prepare(
      `INSERT INTO accountability_logs
         (user_id, strikes_total, strikes_in_cycle, failure_summary, root_cause, corrective_action, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, user.strike_count, inCycle, input.failureSummary, input.rootCause, input.correctiveAction, now);
    db.prepare(
      `UPDATE users SET accountability_required = 0, locked_until = NULL, strikes_at_reset = strike_count WHERE id = ?`,
    ).run(userId);
    logEvent(db, { userId, type: 'accountability', message: `Accountability log filed for ${inCycle} strikes. Access restored.`, at: now });
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function streaks(rows) {
  // rows: per-day aggregates sorted ascending by date.
  let best = 0;
  let run = 0;
  for (const r of rows) {
    if (r.failed > 0) run = 0;
    else if (r.pending === 0) best = Math.max(best, ++run);
  }
  let current = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.failed > 0) break;
    if (r.pending > 0) continue; // today, still in play: neither extends nor breaks the streak
    current++;
  }
  return { current, best };
}

export function lockState(user, now) {
  const locked = Boolean(user.accountability_required) && user.locked_until !== null && now < user.locked_until;
  return {
    locked,
    lockedUntil: user.locked_until,
    accountabilityRequired: Boolean(user.accountability_required),
    canSubmitAccountability: Boolean(user.accountability_required) && !locked,
    strikesInCycle: user.strike_count - user.strikes_at_reset,
    threshold: R.strikeThreshold,
    nextLockoutMinutes: lockoutMinutesFor(user.lockout_count),
  };
}

export function getStats(db, user, now) {
  const today = localDate(now, user.timezone);
  const days = db
    .prepare(
      `SELECT date,
              SUM(status = 'done')    AS done,
              SUM(status = 'failed')  AS failed,
              SUM(status = 'pending') AS pending
       FROM instances WHERE user_id = ? GROUP BY date ORDER BY date`,
    )
    .all(user.id);

  const since = addDays(today, -29);
  let done30 = 0, failed30 = 0, doneAll = 0, failedAll = 0;
  for (const d of days) {
    doneAll += d.done;
    failedAll += d.failed;
    if (d.date >= since) { done30 += d.done; failed30 += d.failed; }
  }
  const rate = (done, failed) => (done + failed === 0 ? null : Math.round((done / (done + failed)) * 1000) / 10);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const d = byDate.get(date);
    last14.push({ date, done: d?.done ?? 0, failed: d?.failed ?? 0, pending: d?.pending ?? 0 });
  }

  return {
    today,
    score: user.score,
    maxScore: R.maxScore,
    streak: streaks(days),
    completionRate30: rate(done30, failed30),
    completionRateAll: rate(doneAll, failedAll),
    totals: { done: doneAll, failed: failedAll },
    strikes: user.strike_count,
    lockouts: user.lockout_count,
    last14,
    rules: { failPenalty: R.failPenalty, completionReward: R.completionReward, strikeThreshold: R.strikeThreshold },
  };
}

/** Per-task consecutive-completion streaks, keyed by task id. */
function taskStreaks(db, userId) {
  const rows = db
    .prepare(`SELECT task_id, status FROM instances WHERE user_id = ? ORDER BY task_id, date DESC`)
    .all(userId);
  const result = new Map();
  const closed = new Set();
  for (const r of rows) {
    if (!result.has(r.task_id)) result.set(r.task_id, 0);
    if (closed.has(r.task_id) || r.status === 'pending') continue;
    if (r.status === 'failed') closed.add(r.task_id);
    else result.set(r.task_id, result.get(r.task_id) + 1);
  }
  return result;
}

export function getToday(db, user, now) {
  const today = localDate(now, user.timezone);
  const rows = db
    .prepare(
      `SELECT i.id, i.task_id, i.title, i.status, i.deadline_at, i.resolved_at, t.description
       FROM instances i JOIN tasks t ON t.id = i.task_id
       WHERE i.user_id = ? AND i.date = ?
       ORDER BY i.deadline_at, i.id`,
    )
    .all(user.id, today);
  const st = taskStreaks(db, user.id);
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    title: r.title,
    description: r.description,
    status: r.status,
    deadlineAt: r.deadline_at,
    resolvedAt: r.resolved_at,
    streak: st.get(r.task_id) ?? 0,
  }));
}

export function listTasks(db, user, now) {
  const today = localDate(now, user.timezone);
  const st = taskStreaks(db, user.id);
  return db
    .prepare('SELECT * FROM tasks WHERE user_id = ? AND archived_at IS NULL ORDER BY deadline_time, id')
    .all(user.id)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      daysMask: t.days_mask,
      deadlineTime: t.deadline_time,
      createdAt: t.created_at,
      streak: st.get(t.id) ?? 0,
      scheduledToday: isScheduledOn(t.days_mask, today),
    }));
}

export function getEvents(db, userId, limit = 50) {
  return db
    .prepare('SELECT id, type, score_delta, message, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(userId, limit)
    .map((e) => ({ id: e.id, type: e.type, scoreDelta: e.score_delta, message: e.message, createdAt: e.created_at }));
}

export function getAccountabilityLogs(db, userId) {
  return db
    .prepare('SELECT * FROM accountability_logs WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map((l) => ({
      id: l.id,
      strikesTotal: l.strikes_total,
      strikesInCycle: l.strikes_in_cycle,
      failureSummary: l.failure_summary,
      rootCause: l.root_cause,
      correctiveAction: l.corrective_action,
      createdAt: l.created_at,
    }));
}

/** Full snapshot the client renders from (and caches for offline use). */
export function getSnapshot(db, userId, now = Date.now()) {
  const user = evaluateUser(db, userId, now);
  return {
    serverTime: now,
    user: { id: user.id, username: user.username, timezone: user.timezone },
    stats: getStats(db, user, now),
    lock: lockState(user, now),
    today: getToday(db, user, now),
    tasks: listTasks(db, user, now),
  };
}
