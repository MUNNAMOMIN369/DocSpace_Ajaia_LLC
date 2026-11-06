import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { pool, verifyDatabaseConnection } from "./db/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDocumentRoutes } from "./routes/documents.js";

const app = express();
const authRouter = express.Router();
const documentRouter = express.Router();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

registerAuthRoutes(authRouter);
registerDocumentRoutes(documentRouter);

app.use("/api/auth", authRouter);
app.use("/api/documents", documentRouter);

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await verifyDatabaseConnection();
    res.status(200).json({
      ok: true,
      status: "healthy",
      environment: env.NODE_ENV,
      database: "connected",
    });
  } catch (error) {
    console.error("[health] Database connection verification failed:", error);
    res.status(503).json({
      ok: false,
      status: "degraded",
      environment: env.NODE_ENV,
      database: "unverified",
      message: "Database connection unavailable",
    });
  }
});

app.get("/api", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    name: "DocSpace API",
    version: "1.0.0",
    status: "online",
  });
});

app.use(notFoundHandler);
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  errorHandler(error, _req, res, _next);
});

const server = app.listen(env.PORT, () => {
  console.log(`DocSpace backend listening on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  await pool.end();
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
