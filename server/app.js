import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';
import { errorHandler } from './middleware/http.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: config.isProd ? undefined : false }));
  app.use(express.json({ limit: '32kb' }));

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, apiRouter(db));

  // Serve the built PWA in production.
  if (fs.existsSync(config.clientDist)) {
    const noCache = new Set(['/sw.js', '/manifest.json', '/index.html']);
    app.use(express.static(config.clientDist, {
      index: false,
      setHeaders(res, file) {
        const rel = '/' + path.relative(config.clientDist, file).split(path.sep).join('/');
        if (noCache.has(rel)) res.set('Cache-Control', 'no-cache');
        else if (rel.startsWith('/assets/')) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        if (rel === '/manifest.json') res.type('application/manifest+json');
      },
    }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
