/**
 * Global Express error handler — fail-closed, generic responses.
 */
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[ERROR]', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error' });
}
