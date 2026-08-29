import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isDev } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/error.js';
import { notFound } from './middleware/notFound.js';
import { apiRouter } from './routes.js';
import seoRouter from './modules/seo/seo.routes.js';
import { checkDatabaseReadiness, type DatabaseReadiness } from './ops/readiness.js';

interface AppOptions {
  readinessCheck?: () => Promise<DatabaseReadiness>;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const readinessCheck = options.readinessCheck ?? checkDatabaseReadiness;

  app.set('trust proxy', 1);

  // Security headers. crossOriginResourcePolicy relaxed so the SPA on another
  // origin can consume responses; images are served from Cloudinary anyway.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // SPA is served separately; CSP handled at the edge/host
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (isDev) app.use(morgan('dev'));

  // Liveness: confirms that the Node process can answer HTTP requests. Keep
  // this independent of dependencies so orchestrators do not restart a healthy
  // process during a transient database outage.
  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Readiness: safe for Render and external monitors. It only reports whether
  // PostgreSQL answered and never exposes connection details or raw errors.
  app.get('/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const database = await readinessCheck();
      res.json({
        status: 'ready',
        uptime: process.uptime(),
        checks: { database: { status: 'ok', latencyMs: database.latencyMs } },
      });
    } catch {
      res.status(503).json({
        status: 'unavailable',
        uptime: process.uptime(),
        checks: { database: { status: 'error' } },
      });
    }
  });

  // SEO (served at root: /sitemap.xml, /robots.txt)
  app.use('/', seoRouter);

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
