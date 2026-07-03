/**
 * Global Express error handler — fail-closed, generic responses.
 */
import { Request, Response, NextFunction } from 'express';
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
