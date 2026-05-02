import { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError ? err.message : "Internal Server Error";

  const reqWithId = req as Request & { id?: string };

  logger.error(
    {
      err,
      requestId: reqWithId.id,
      method: req.method,
      url: req.url,
    },
    message,
  );

  res.status(statusCode).json({
    error: {
      message,
      requestId: reqWithId.id ?? null,
      ...(process.env["NODE_ENV"] !== "production"
        ? { stack: err.stack }
        : {}),
    },
  });
}
