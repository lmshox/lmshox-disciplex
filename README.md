# DISCIPLEX

A strict self-development and accountability tracker, built as an installable Progressive Web App.
Deadlines are enforced by the server clock. A missed task is marked **FAILED**, costs score points,
and adds a strike. Enough strikes trigger a timed lockout followed by a mandatory written accountability log.

## Stack

| Layer    | Tech |
|----------|------|
| Client   | React 19, Vite 8, Tailwind CSS 4, lucide-react |
| PWA      | Hand-written `manifest.json` + service worker (precache list generated at build time) |
| Server   | Node 22 (≥ 22.13), Express 5, zod, helmet |
| Database | SQLite via built-in `node:sqlite` (no native build step) |

## Quick start

```bash
npm install
npm run dev          # API on :3001 + Vite on :5173 (proxying /api)
```

Production:

```bash
npm run build && npm start   # serves the PWA + API on :3001
```

Tests: `npm test` (engine: scheduling, DST, penalties, lockout, streaks, anti-gaming rules).

Docker: `docker build -t disciplex . && docker run -p 3001:3001 -v disciplex-data:/data disciplex`

> Service workers and installation need **HTTPS** (or `localhost`). Put the server behind a TLS-terminating proxy in production.

## Rules (the engine)

All logic lives in `server/services/engine.js` and runs on every request plus a background tick every 30 s.

- **Occurrences.** Each task generates one occurrence per scheduled day, in the user's timezone. A task created after today's deadline starts tomorrow.
- **Frozen deadlines.** An occurrence's deadline and title are fixed when it is generated. Editing a task applies from the next occurrence, so you can't push a deadline back to dodge a failure.
- **Archiving** stops future occurrences. Today's occurrence still counts.
- **FAILED.** When the deadline passes on a pending occurrence: status becomes `failed`, score goes down by `FAIL_PENALTY` (10), and the strike count goes up by 1. Days missed while offline are backfilled and failed too.
- **Done** adds `COMPLETION_REWARD` (2) to the score, capped at 100. Completion is final, and the server's time is the time of record.
- **Lockout.** When strikes since the last accountability log reach `STRIKE_THRESHOLD` (3), the system locks for `LOCKOUT_BASE_MINUTES` (15). Each later lockout doubles in length, up to 24 h.
  - During a lockout, creating, editing or archiving tasks is blocked (HTTP 423).
  - Pending tasks can still be completed, so a lockout can't cascade into more failures.
- **Accountability.** After the timer runs out, you must file a three-part log (what happened, root cause, corrective action, each at least 20 characters) before task changes unlock. The total strike count is never erased.
- **Metrics.**
  - Active streak: consecutive days on which every scheduled occurrence was done. Today is neutral while still in play.
  - Best streak.
  - 30-day completion rate: done / (done + failed).
  - Score, total strikes, and a 14-day activity strip.

All thresholds can be set through environment variables (see `server/config.js`).

## Offline behaviour

- The app shell is precached by `client/src/sw.js`. It opens offline with the last synced snapshot, which is cached per user in `localStorage`.
- Completions made offline go into an outbox and replay when the connection returns. They are judged **by server time on arrival**, which keeps the system strict.
- `/api/*` is never cached by the service worker, so data can't leak between accounts on a shared device.
- When a new build is deployed, the app shows a "new version" toast with a reload button.

## Install banner

`InstallBanner.jsx` gives platform-specific install guidance:
- **Chromium (Android, desktop):** a one-tap button using `beforeinstallprompt`.
- **iOS:** Share → Add to Home Screen.
- **macOS Safari:** File → Add to Dock.
- **Other browsers:** fallback instructions.

The banner hides when the app is already running standalone, and stays hidden for 14 days after it is dismissed.

## Layout

```
server/
  config.js            rules & env configuration
  db.js                schema migrations, transactions
  lib/time.js          Intl-based timezone math (DST-safe)
  services/engine.js   scheduling, penalties, lockouts, stats
  services/auth.js     scrypt passwords, hashed bearer sessions
  routes/api.js        REST endpoints
  test/                node:test suite
client/
  public/              manifest.json, icons
  src/sw.js            service worker template
  src/hooks/           state store, install prompt, SW updates, clock
  src/components/      UI components
scripts/generate-icons.js   renders icons/icon.svg → PNGs (Playwright)
```
