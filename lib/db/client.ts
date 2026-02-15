import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

function normalizeConnectionString(urlString: string): string {
  try {
    const url = new URL(urlString);
    const sslmode = url.searchParams.get("sslmode");
    const hasCompatFlag = url.searchParams.has("uselibpqcompat");

    if ((sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca") && !hasCompatFlag) {
      // Preserve libpq-compatible TLS semantics for current pg behavior and avoid local TLS chain failures.
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    return urlString;
  }
}

declare global {
  // Reuse the same pool during Next.js dev hot reload to avoid excess connections.
  var __dbPool: Pool | undefined;
}

const pool =
  globalThis.__dbPool ??
  new Pool({
    connectionString: normalizeConnectionString(databaseUrl)
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
