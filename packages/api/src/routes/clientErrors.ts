import { Router } from 'express';
import { createRateLimiter } from '../rateLimit';

export const clientErrorsRouter = Router();

/**
 * Receives errors the browser hit and writes them to the server log.
 *
 * Without this a render error left no trace anywhere: the error boundary shows a readable
 * page and logs to the visitor's console, which nobody ever sees. "It broke yesterday" was
 * unanswerable. This is not a replacement for a real error service — there is no grouping,
 * no history beyond the log retention, no alerting — but it is the difference between
 * having a record and having none, and it adds no dependency or third-party account.
 *
 * Anonymous and public, so it is capped hard: a short body, a handful of fields, and a
 * per-IP limit. A flood cannot fill the log or cost anything.
 */
const limited = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });

const MAX = { message: 300, stack: 2000, url: 300, component: 2000 };
const clamp = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';

clientErrorsRouter.post('/', (req, res) => {
  const ip = req.ip ?? 'unknown';
  if (limited(ip)) {
    // 204 rather than 429: the client cannot act on it, and a page that is already broken
    // should not then report a failed report.
    res.status(204).end();
    return;
  }

  const body = req.body as Record<string, unknown>;
  const message = clamp(body.message, MAX.message);
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  console.error(
    `[client] ${message}\n  url=${clamp(body.url, MAX.url) || 'unknown'}\n  ua=${clamp(req.headers['user-agent'], 200)}\n  stack=${clamp(body.stack, MAX.stack) || 'none'}\n  component=${clamp(body.component, MAX.component) || 'none'}`,
  );
  res.status(204).end();
});
