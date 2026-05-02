import { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof existing === "string" && existing.length > 0
      ? existing
      : crypto.randomUUID();

  (req as Request & { id: string }).id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
