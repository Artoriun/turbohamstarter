import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';

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
 * Every async route in this project goes through here.
 *
 * Express 5 forwards a rejected promise to the error handler by itself, so this is now belt
 * and braces rather than load-bearing. It is kept because removing it touches all eleven
 * routes, which is not a change worth folding into a major upgrade of the framework
 * underneath them — it wants its own diff, where a mistake is visible.
 *
 * The parameter type is generic so a route can say what its own params are. Express 5 types
 * an untyped `req.params` value as `string | string[]`, since a repeated or wildcard segment
 * can legitimately produce several — true in general, and not true of `/:id`.
 */
export function asyncHandler<P = ParamsDictionary>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler<P> {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
