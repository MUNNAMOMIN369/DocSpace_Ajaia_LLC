import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const isNeonConnection = env.DATABASE_URL.includes("neon.tech");

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isNeonConnection ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, {
  schema,
  logger: env.NODE_ENV === "development",
});

export async function verifyDatabaseConnection(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("SELECT NOW() AS current_time");
  } finally {
    client.release();
  }
}
