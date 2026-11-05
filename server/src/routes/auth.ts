import bcrypt from "bcrypt";
import type { Request, Response, Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { clearSessionCookie, setSessionCookie, signToken } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function sanitizeUser(user: { id: string; name: string; email: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export function registerAuthRoutes(router: Router): void {
  router.post("/signup", async (req: Request, res: Response) => {
    try {
      const payload = signUpSchema.parse(req.body);
      const email = payload.email.toLowerCase();

      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        res.status(409).json({ ok: false, message: "An account with this email already exists." });
        return;
      }

      const passwordHash = await bcrypt.hash(payload.password, 12);
      const inserted = await db
        .insert(users)
        .values({
          name: payload.name.trim(),
          email,
          passwordHash,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
        });

      const user = inserted[0];
      const token = signToken({ id: user.id, name: user.name, email: user.email });
      setSessionCookie(res, token);

      res.status(201).json({
        ok: true,
        user: sanitizeUser(user),
        message: "Account created successfully.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, message: error.issues[0]?.message ?? "Invalid request." });
        return;
      }

      res.status(500).json({ ok: false, message: "Could not create the account." });
    }
  });

  router.post("/login", async (req: Request, res: Response) => {
    try {
      const payload = loginSchema.parse(req.body);
      const email = payload.email.toLowerCase();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        res.status(401).json({ ok: false, message: "Invalid email or password." });
        return;
      }

      const isMatch = await bcrypt.compare(payload.password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ ok: false, message: "Invalid email or password." });
        return;
      }

      const token = signToken({ id: user.id, name: user.name, email: user.email });
      setSessionCookie(res, token);

      res.json({
        ok: true,
        user: sanitizeUser(user),
        message: "Signed in successfully.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, message: error.issues[0]?.message ?? "Invalid request." });
        return;
      }

      res.status(500).json({ ok: false, message: "Unable to sign in." });
    }
  });

  router.post("/logout", (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.json({ ok: true, message: "Signed out successfully." });
  });

  router.get("/me", requireAuth, (req: Request, res: Response) => {
    res.json({
      ok: true,
      user: sanitizeUser({
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
      }),
    });
  });
}
