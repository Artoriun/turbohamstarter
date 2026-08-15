import './loadEnv';
import cors from 'cors';
import express from 'express';
import { db } from './firebaseAdmin';
import { usingPlaintextPassword } from './password';
import { authRouter } from './routes/auth';
import { clientErrorsRouter } from './routes/clientErrors';
import { contactRouter } from './routes/contact';
import { contentRouter } from './routes/content';
import { settingsRouter } from './routes/settings';

const app = express();
const PORT = process.env.PORT ?? 3700;

// Hosts like Render terminate TLS at a proxy, so without this req.ip is the proxy's
// address and every per-IP rate limit would apply to all visitors collectively. One hop
// only — trusting the whole chain would let a client spoof X-Forwarded-For.
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:3000',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
];

app.use(cors({ origin: allowedOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

/**
 * Liveness only. Deliberately does not touch Firestore or Cloudinary: a health check that
 * depends on downstream services turns a blip in one of them into a restart loop. Point
 * your host's health check here.
 *
 * Also the endpoint to point an UptimeRobot monitor at, every 5 minutes: a free Render
 * instance sleeps after ~15 minutes idle and the next visitor pays a 30-60s cold start.
 * Ping this one rather than /health/deps — the deep probe reads Firestore, so a 5-minute
 * interval would burn thousands of reads a month against the free quota for nothing.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

/**
 * Deeper probe, for uptime monitoring rather than the host's health check.
 *
 * This exists because GET /api/content swallows Firestore errors and serves the bundled
 * fallback with a 200. That is right for visitors, but it means the site can look
 * perfectly healthy while every admin edit has silently stopped appearing, with nothing
 * to alert on. This endpoint goes red in that case.
 */
const DEPS_TIMEOUT_MS = Number(process.env.HEALTH_DEPS_TIMEOUT_MS ?? 5000);
const DEPS_CACHE_MS = 30_000;
let depsCache: { at: number; ok: boolean; ms: number } | null = null;

app.get('/health/deps', async (_req, res) => {
  // Cached briefly: the endpoint is public and each miss costs a Firestore read, so a
  // flood cannot burn the free quota. 30s is well under any sane monitoring interval.
  if (depsCache && Date.now() - depsCache.at < DEPS_CACHE_MS) {
    res.status(depsCache.ok ? 200 : 503).json({
      status: depsCache.ok ? 'ok' : 'degraded',
      firestore: depsCache.ok ? 'ok' : 'unreachable',
      ms: depsCache.ms,
      cached: true,
    });
    return;
  }

  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    // A single doc get, not a scan — cheap, and enough to prove credentials and
    // reachability. Points at the settings doc rather than an arbitrary path so it is
    // reading something the app actually uses, not a doc kept alive only for this check.
    await Promise.race([
      db.collection('config').doc('settings').get(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), DEPS_TIMEOUT_MS);
      }),
    ]);
    const ms = Date.now() - started;
    depsCache = { at: Date.now(), ok: true, ms };
    res.json({ status: 'ok', firestore: 'ok', ms });
  } catch (err) {
    const ms = Date.now() - started;
    depsCache = { at: Date.now(), ok: false, ms };
    // Logged in full, reported generically — this endpoint is public.
    console.error('[health/deps] firestore check failed:', err);
    res.status(503).json({ status: 'degraded', firestore: 'unreachable', ms });
  } finally {
    clearTimeout(timer);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/client-errors', clientErrorsRouter);
app.use('/api/content', contentRouter);
app.use('/api/settings', settingsRouter);

/**
 * Last in the chain, so anything asyncHandler forwards lands here rather than escaping to
 * the process. A missing Firestore is reported as 503 (the deployment is incomplete, the
 * request was fine) rather than 500, so the admin portal can say something useful instead
 * of "unknown error".
 */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const unconfigured = err.message?.includes('not configured');
  console.error('[api]', err.message);
  res
    .status(unconfigured ? 503 : 500)
    .json({ error: unconfigured ? err.message : 'Internal error' });
});

// A rejection that somehow escapes the wrapper is logged rather than fatal. Without this,
// Node's default is to terminate — which on a free tier means a cold start for the next
// visitor because one background call failed.
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);

  // Said once at startup rather than per request, and only where it changes what you
  // should do next. The API is designed to boot without any of this so `npm run dev`
  // works on a fresh clone — these are the things that are silently inert until set.
  if (!process.env.JWT_SECRET) {
    console.warn('[auth] JWT_SECRET is unset — admin login is disabled until you set it.');
  }
  if (usingPlaintextPassword()) {
    console.warn(
      '[auth] using plaintext ADMIN_PASSWORD. Run `npm run hash-password` and set ADMIN_PASSWORD_HASH instead.',
    );
  }
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn('[content] Firestore is unconfigured — serving bundled content, edits will fail.');
  }
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    console.warn('[contact] no mail transport — POST /api/contact will answer 503.');
  }
  if (!process.env.CLOUDINARY_URL) {
    console.warn('[content] CLOUDINARY_URL is unset — image upload will answer 503.');
  }
});
