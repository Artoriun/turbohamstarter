import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so a rejected promise reaches Express instead of the
 * process.
 *
 * Express 4 predates async handlers: it only catches what a handler throws synchronously.
 * A rejection inside `async (req, res) => { await db... }` propagates as an unhandled
 * rejection, which Node terminates the process for by default. One unreachable Firestore
 * call would take the whole API down — and on a free tier, "unreachable" is a normal
 * Tuesday.
 *
 * Every async route in this project goes through here. Express 5 does this natively; drop
 * this file if you upgrade.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
