import { config } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { evaluateAll } from './services/engine.js';
import { purgeExpiredSessions } from './services/auth.js';

const db = openDatabase(config.dbPath);
const app = createApp(db);

// Background evaluator: fails overdue tasks and engages lockouts even when no client is open.
const tick = () => {
  try {
    evaluateAll(db);
    purgeExpiredSessions(db);
  } catch (err) {
    console.error('[evaluator]', err);
  }
};
tick();
const timer = setInterval(tick, config.evaluatorIntervalMs);

const server = app.listen(config.port, () => {
  console.log(`DISCIPLEX API listening on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
});

const shutdown = () => {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
