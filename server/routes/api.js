import { Router } from 'express';
import * as auth from '../services/auth.js';
import * as engine from '../services/engine.js';
import { bearerToken, rateLimit, requireAuth } from '../middleware/http.js';
import { accountabilitySchema, credentialsSchema, idParam, registerSchema, taskSchema } from '../validation.js';

export function apiRouter(db) {
  const r = Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30 });
  const snapshot = (req) => engine.getSnapshot(db, req.userId, Date.now());

  r.get('/health', (req, res) => res.json({ ok: true, time: Date.now() }));

  // --- Auth ---------------------------------------------------------------
  r.post('/auth/register', authLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { token } = await auth.register(db, input);
    res.status(201).json({ token });
  });

  r.post('/auth/login', authLimiter, async (req, res) => {
    const input = credentialsSchema.parse(req.body);
    const { token } = await auth.login(db, input);
    res.json({ token });
  });

  r.post('/auth/logout', (req, res) => {
    auth.destroySession(db, bearerToken(req));
    res.status(204).end();
  });

  // --- Authenticated ------------------------------------------------------
  r.use(requireAuth(db));

  r.get('/state', (req, res) => res.json(snapshot(req)));

  r.post('/tasks', (req, res) => {
    engine.createTask(db, req.userId, taskSchema.parse(req.body));
    res.status(201).json(snapshot(req));
  });

  r.put('/tasks/:id', (req, res) => {
    engine.updateTask(db, req.userId, idParam.parse(req.params.id), taskSchema.parse(req.body));
    res.json(snapshot(req));
  });

  r.delete('/tasks/:id', (req, res) => {
    engine.archiveTask(db, req.userId, idParam.parse(req.params.id));
    res.json(snapshot(req));
  });

  r.post('/instances/:id/complete', (req, res) => {
    engine.completeInstance(db, req.userId, idParam.parse(req.params.id));
    res.json(snapshot(req));
  });

  r.post('/accountability', (req, res) => {
    engine.submitAccountability(db, req.userId, accountabilitySchema.parse(req.body));
    res.status(201).json(snapshot(req));
  });

  r.get('/history', (req, res) => {
    engine.evaluateUser(db, req.userId);
    res.json({
      events: engine.getEvents(db, req.userId, 100),
      accountability: engine.getAccountabilityLogs(db, req.userId),
    });
  });

  r.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } }));
  return r;
}
