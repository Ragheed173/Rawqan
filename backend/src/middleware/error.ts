import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

/** Terminal error handler → uniform JSON envelope. Must be registered last. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    // Thrown by express.json() on a malformed request body.
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON in request body';
  } else if (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { status?: unknown; statusCode?: unknown }).status === 'number'
  ) {
    // Generic http-errors (e.g. from body/urlencoded parsers): honor their status.
    const httpErr = err as { status: number; message?: string };
    status = httpErr.status;
    code = 'REQUEST_ERROR';
    message = httpErr.message ?? 'Request error';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      message = `A record with this ${target} already exists`;
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Record not found';
    } else {
      status = 400;
      code = 'DB_ERROR';
      message = 'Database request error';
    }
  }

  if (status >= 500) {
     
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(!isProd && status >= 500 && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
};
