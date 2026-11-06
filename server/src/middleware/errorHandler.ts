import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    message: "Route not found.",
  });
}

export function errorHandler(
  error: Error & { statusCode?: number; status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = error instanceof ZodError ? 400 : error.statusCode ?? error.status ?? 500;
  if (statusCode >= 500) {
    console.error("[api] Request failed:", error);
  }

  const response: Record<string, unknown> = {
    ok: false,
    message: error instanceof ZodError
      ? error.issues[0]?.message ?? "Invalid request."
      : statusCode >= 500
        ? "Internal server error."
        : error.message || "Internal server error.",
  };

  res.status(statusCode).json(response);
}
