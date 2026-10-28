import type { ErrorRequestHandler } from 'express';

/**
 * Last in the chain, so anything asyncHandler forwards lands here rather than escaping to the
 * process.
 *
 * Three answers, chosen by whose fault it is:
 *
 * - **503** when a dependency was never configured. The request was fine and the deployment is
 *   incomplete, so the message is passed through — the admin portal can then say something
 *   useful instead of "unknown error".
 * - **400** when the error carries its own status, which is how Express's body parser reports a
 *   body it could not read. Answering 500 to a malformed request sends whoever is debugging it
 *   into the server logs to look for a fault that is in their own payload.
 * - **500** otherwise, with the detail logged and not returned. Internal messages name internal
 *   things; "firestore unavailable" is for the operator, not the caller.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = err as Error & { status?: number; statusCode?: number };
  const unconfigured = error.message?.includes('not configured');
  const carried = error.status ?? error.statusCode;
  const status = unconfigured ? 503 : (carried ?? 500);

  console.error('[api]', error.message);

  res.status(status).json({
    error: unconfigured
      ? error.message
      : status >= 400 && status < 500
        ? 'Malformed request'
        : 'Internal error',
  });
};
