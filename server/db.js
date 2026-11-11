import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 1;

const MIGRATIONS = {
  1: `
    CREATE TABLE users (
      id                      INTEGER PRIMARY KEY,
      username                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash           TEXT    NOT NULL,
      timezone                TEXT    NOT NULL,
      score                   INTEGER NOT NULL,
      strike_count            INTEGER NOT NULL DEFAULT 0,
      strikes_at_reset        INTEGER NOT NULL DEFAULT 0,
      lockout_count           INTEGER NOT NULL DEFAULT 0,
      locked_until            INTEGER,
      accountability_required INTEGER NOT NULL DEFAULT 0,
      last_generated_date     TEXT,
      created_at              INTEGER NOT NULL
    );

    CREATE TABLE sessions (
      token_hash TEXT    PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);

    CREATE TABLE tasks (
      id            INTEGER PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT    NOT NULL,
      description   TEXT    NOT NULL DEFAULT '',
      days_mask     INTEGER NOT NULL,           -- bit 0 = Sunday … bit 6 = Saturday
      deadline_time TEXT    NOT NULL,           -- "HH:MM" in the user's timezone
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      archived_at   INTEGER
    );
    CREATE INDEX idx_tasks_user ON tasks(user_id, archived_at);

    -- One row per scheduled occurrence. Deadline is frozen at generation time so
    -- editing a task can never rescue an occurrence that is already in play.
    CREATE TABLE instances (
      id           INTEGER PRIMARY KEY,
      task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date         TEXT    NOT NULL,
      title        TEXT    NOT NULL,
      deadline_at  INTEGER NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
      resolved_at  INTEGER,
      UNIQUE (task_id, date)
    );
    CREATE INDEX idx_instances_due  ON instances(user_id, status, deadline_at);
    CREATE INDEX idx_instances_date ON instances(user_id, date);

    CREATE TABLE events (
      id          INTEGER PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL,
      score_delta INTEGER NOT NULL DEFAULT 0,
      message     TEXT    NOT NULL,
      instance_id INTEGER,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX idx_events_user ON events(user_id, created_at DESC);

    CREATE TABLE accountability_logs (
      id                INTEGER PRIMARY KEY,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strikes_total     INTEGER NOT NULL,
      strikes_in_cycle  INTEGER NOT NULL,
      failure_summary   TEXT    NOT NULL,
      root_cause        TEXT    NOT NULL,
      corrective_action TEXT    NOT NULL,
      created_at        INTEGER NOT NULL
    );
  `,
};

export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v}`);
    });
  }
  return db;
}

/** Runs `fn` inside a transaction (re-entrant: nested calls join the outer one). */
export function transaction(db, fn) {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
