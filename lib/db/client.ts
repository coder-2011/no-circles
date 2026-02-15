import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

declare global {
  // Reuse the same pool during Next.js dev hot reload to avoid excess connections.
  var __dbPool: Pool | undefined;
}

const pool = globalThis.__dbPool ?? new Pool({ connectionString: databaseUrl });

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
