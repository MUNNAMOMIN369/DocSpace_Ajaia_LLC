import type { NextFunction, Request, Response } from "express";
import { getSessionUser } from "../lib/auth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);

  if (!user) {
    res.status(401).json({ ok: false, message: "Authentication required." });
    return;
  }

  req.user = user;
  next();
}
