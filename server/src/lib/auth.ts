import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export const SESSION_COOKIE_NAME = "docspace_session";

export function signToken(user: SessionUser): string {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): SessionUser {
  const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

  if (!decoded.sub || typeof decoded.sub !== "string") {
    throw new Error("Invalid session token");
  }

  return {
    id: decoded.sub,
    name: typeof decoded.name === "string" ? decoded.name : "DocSpace User",
    email: typeof decoded.email === "string" ? decoded.email : "",
  };
}

export function getSessionUser(req: Request): SessionUser | null {
  const cookies = req.headers.cookie ?? "";
  const cookiePair = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!cookiePair) {
    return null;
  }

  const token = decodeURIComponent(cookiePair.split("=")[1] ?? "");
  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });
}
