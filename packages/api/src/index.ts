import './loadEnv';
import cors from 'cors';
import express from 'express';
import { db } from './firebaseAdmin';
import { usingPlaintextPassword } from './password';
import { authRouter } from './routes/auth';
import { clientErrorsRouter } from './routes/clientErrors';
import { contactRouter } from './routes/contact';
import { poemsRouter } from './routes/poems';

const app = express();
const PORT = process.env.PORT ?? 4000;

// Render terminates TLS at its proxy, so without this req.ip is the proxy's address and
// the contact form's per-IP rate limit would apply to every visitor collectively. One hop
// only — trusting the whole chain would let a client spoof X-Forwarded-For.
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:3000',
  ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
];

app.use(cors({ origin: allowedOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Liveness probe for Render's health check and for uptime monitoring. Deliberately does
// not touch Firebase or Cloudinary: a health check that depends on downstream services
// turns a blip in one of them into a restart loop.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Deeper probe for uptime monitoring: actually reads from Firestore, so it fails when the
// data layer is broken. Explicitly NOT what Render's healthCheckPath points at — a health
// check that goes red when Firebase blips would have Render restart a healthy container.
//
// This exists because GET /api/poems swallows Firestore errors and serves the hardcoded
// fallback with a 200. Good for visitors, but it means the site can look perfectly healthy
// while every admin edit has silently stopped appearing, with nothing to alert on.
const DEPS_TIMEOUT_MS = Number(process.env.HEALTH_DEPS_TIMEOUT_MS ?? 5000);
const DEPS_CACHE_MS = 30_000;
let depsCache: { at: number; ok: boolean; ms: number } | null = null;

app.get('/health/deps', async (_req, res) => {
  // Cached briefly: the endpoint is public and each miss costs a Firestore read, so a
  // flood cannot burn the quota. 30s is well under any sane monitoring interval.
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
    // A single doc get, not a scan — cheap, and enough to prove credentials and reachability.
    await Promise.race([
      db.collection('config').doc('poemOrder').get(),
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
app.use('/api/poems', poemsRouter);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  // Said once at startup rather than per request. Not an error — the plaintext form stays
  // supported on purpose so an existing deployment keeps working — but it does mean the
  // password is readable in the hosting dashboard, and `npm run hash-password` fixes that.
  if (usingPlaintextPassword()) {
    console.warn(
      '[auth] using plaintext ADMIN_PASSWORD. Run `npm run hash-password` and set ADMIN_PASSWORD_HASH instead.',
    );
  }
});
