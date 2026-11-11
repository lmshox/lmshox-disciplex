import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.js';
import * as engine from '../services/engine.js';
import { zonedToUtc, localDate } from '../lib/time.js';
import { config } from '../config.js';

const TZ = 'America/New_York';
const EVERY_DAY = 0b1111111;
const at = (date, time) => zonedToUtc(date, time, TZ);
const R = config.rules;

let db, userId;
beforeEach(() => {
  db = openDatabase(':memory:');
  userId = Number(
    db.prepare('INSERT INTO users (username, password_hash, timezone, score, created_at) VALUES (?,?,?,?,?)')
      .run('tester', 'x', TZ, R.startingScore, at('2026-03-01', '06:00')).lastInsertRowid,
  );
});

const task = (deadlineTime, now, extra = {}) =>
  engine.createTask(db, userId, { title: `T ${deadlineTime}`, description: '', deadlineTime, daysMask: EVERY_DAY, ...extra }, now);

describe('time helpers', () => {
  test('converts wall-clock across DST boundaries', () => {
    assert.equal(new Date(at('2026-01-15', '07:00')).toISOString(), '2026-01-15T12:00:00.000Z'); // EST
    assert.equal(new Date(at('2026-07-15', '07:00')).toISOString(), '2026-07-15T11:00:00.000Z'); // EDT
    assert.equal(localDate(Date.parse('2026-07-16T03:30:00Z'), TZ), '2026-07-15');
  });
});

describe('scheduling', () => {
  test('task created before today\'s deadline gets an occurrence today', () => {
    task('07:00', at('2026-03-01', '06:30'));
    const snap = engine.getSnapshot(db, userId, at('2026-03-01', '06:31'));
    assert.equal(snap.today.length, 1);
    assert.equal(snap.today[0].status, 'pending');
  });

  test('task created after today\'s deadline starts tomorrow', () => {
    task('07:00', at('2026-03-01', '09:00'));
    assert.equal(engine.getSnapshot(db, userId, at('2026-03-01', '09:01')).today.length, 0);
    assert.equal(engine.getSnapshot(db, userId, at('2026-03-02', '00:01')).today.length, 1);
  });

  test('respects day-of-week mask', () => {
    // 2026-03-02 is a Monday. Only schedule Tuesdays (bit 2).
    task('07:00', at('2026-03-01', '20:00'), { daysMask: 1 << 2 });
    assert.equal(engine.getSnapshot(db, userId, at('2026-03-02', '01:00')).today.length, 0);
    assert.equal(engine.getSnapshot(db, userId, at('2026-03-03', '01:00')).today.length, 1);
  });
});

describe('penalties', () => {
  test('missed deadline is FAILED with score deduction and a strike', () => {
    task('07:00', at('2026-03-01', '06:00'));
    const snap = engine.getSnapshot(db, userId, at('2026-03-01', '07:00'));
    assert.equal(snap.today[0].status, 'failed');
    assert.equal(snap.stats.score, R.startingScore - R.failPenalty);
    assert.equal(snap.stats.strikes, 1);
  });

  test('cannot complete after the deadline', () => {
    task('07:00', at('2026-03-01', '06:00'));
    const id = engine.getSnapshot(db, userId, at('2026-03-01', '06:10')).today[0].id;
    assert.throws(() => engine.completeInstance(db, userId, id, at('2026-03-01', '07:01')), { code: 'DEADLINE_PASSED' });
  });

  test('completion before deadline counts, is idempotent, and score is capped', () => {
    task('07:00', at('2026-03-01', '06:00'));
    const id = engine.getSnapshot(db, userId, at('2026-03-01', '06:10')).today[0].id;
    engine.completeInstance(db, userId, id, at('2026-03-01', '06:59'));
    assert.deepEqual(engine.completeInstance(db, userId, id, at('2026-03-01', '06:59')), { alreadyDone: true });
    const snap = engine.getSnapshot(db, userId, at('2026-03-01', '08:00'));
    assert.equal(snap.today[0].status, 'done');
    assert.equal(snap.stats.score, R.maxScore);
    assert.equal(snap.stats.strikes, 0);
    assert.equal(snap.stats.streak.current, 1);
  });

  test('editing a task cannot move the deadline of an occurrence in play', () => {
    const taskId = task('07:00', at('2026-03-01', '06:00'));
    engine.updateTask(db, userId, taskId, { title: 'Moved', description: '', deadlineTime: '23:00', daysMask: EVERY_DAY }, at('2026-03-01', '06:30'));
    const snap = engine.getSnapshot(db, userId, at('2026-03-01', '07:00'));
    assert.equal(snap.today[0].status, 'failed');
  });

  test('archiving a task does not cancel today\'s occurrence', () => {
    const taskId = task('07:00', at('2026-03-01', '06:00'));
    engine.archiveTask(db, userId, taskId, at('2026-03-01', '06:30'));
    const snap = engine.getSnapshot(db, userId, at('2026-03-01', '07:30'));
    assert.equal(snap.today[0].status, 'failed');
    assert.equal(engine.getSnapshot(db, userId, at('2026-03-02', '08:00')).today.length, 0);
  });

  test('offline days are backfilled and failed when the user returns', () => {
    task('07:00', at('2026-03-01', '06:00'));
    const snap = engine.getSnapshot(db, userId, at('2026-03-03', '08:00'));
    assert.equal(snap.stats.strikes, 3);
    assert.equal(snap.stats.totals.failed, 3);
  });
});

describe('lockout & accountability', () => {
  const failThree = () => {
    task('07:00', at('2026-03-01', '06:00'));
    task('07:01', at('2026-03-01', '06:00'));
    task('07:02', at('2026-03-01', '06:00'));
    return engine.getSnapshot(db, userId, at('2026-03-01', '07:05'));
  };

  test('threshold strikes trigger a timed lockout that blocks task changes', () => {
    const snap = failThree();
    assert.equal(snap.lock.locked, true);
    assert.equal(snap.lock.lockedUntil, at('2026-03-01', '07:05') + R.lockoutBaseMinutes * 60_000);
    assert.throws(() => task('09:00', at('2026-03-01', '07:06')), { code: 'LOCKED_OUT' });
    assert.throws(
      () => engine.submitAccountability(db, userId, { failureSummary: 'x', rootCause: 'x', correctiveAction: 'x' }, at('2026-03-01', '07:06')),
      { code: 'LOCKED_OUT' },
    );
  });

  test('after lockout expires, accountability is still required, then access restores', () => {
    failThree();
    const after = at('2026-03-01', '07:05') + R.lockoutBaseMinutes * 60_000;
    const snap = engine.getSnapshot(db, userId, after);
    assert.equal(snap.lock.locked, false);
    assert.equal(snap.lock.canSubmitAccountability, true);
    assert.throws(() => task('09:00', after), { code: 'ACCOUNTABILITY_REQUIRED' });

    engine.submitAccountability(db, userId, { failureSummary: 'a', rootCause: 'b', correctiveAction: 'c' }, after);
    const restored = engine.getSnapshot(db, userId, after);
    assert.equal(restored.lock.accountabilityRequired, false);
    assert.equal(restored.lock.strikesInCycle, 0);
    assert.equal(restored.stats.strikes, 3, 'total strikes are never erased');
    assert.equal(restored.lock.nextLockoutMinutes, R.lockoutBaseMinutes * 2, 'lockouts escalate');
    assert.doesNotThrow(() => task('09:00', after));
  });

  test('tasks can still be completed during lockout', () => {
    task('08:00', at('2026-03-01', '06:00'));
    const snap = failThree();
    assert.equal(snap.lock.locked, true);
    const pending = snap.today.find((t) => t.status === 'pending');
    assert.doesNotThrow(() => engine.completeInstance(db, userId, pending.id, at('2026-03-01', '07:10')));
  });
});

describe('streaks & rates', () => {
  test('streak counts consecutive fully-completed days; a failure resets it', () => {
    task('07:00', at('2026-03-01', '06:00'));
    const complete = (date) => {
      const id = engine.getSnapshot(db, userId, at(date, '06:00')).today[0].id;
      engine.completeInstance(db, userId, id, at(date, '06:30'));
    };
    complete('2026-03-01');
    complete('2026-03-02');
    // 03-03 missed
    complete('2026-03-04');
    complete('2026-03-05');
    complete('2026-03-06');
    const snap = engine.getSnapshot(db, userId, at('2026-03-07', '06:00')); // today pending: neutral
    assert.equal(snap.stats.streak.current, 3);
    assert.equal(snap.stats.streak.best, 3);
    assert.equal(snap.stats.completionRate30, 83.3);
    assert.equal(snap.today[0].streak, 3);
  });
});
