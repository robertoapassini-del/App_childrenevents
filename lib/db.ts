import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Prisma 7 connects through a driver adapter, so which database we're on is a
 * runtime choice made from DATABASE_URL: SQLite for local development, Postgres
 * wherever this is deployed (serverless filesystems are ephemeral, so SQLite
 * cannot survive there).
 *
 * The schema's `datasource provider` still has to match, and Prisma resolves
 * that at generate time — scripts/sync-db-provider.mjs rewrites it from the
 * same URL before `prisma generate` runs.
 */

export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export function isPostgres(url = DATABASE_URL): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

function createClient() {
  const adapter = isPostgres()
    ? new PrismaPg({ connectionString: DATABASE_URL })
    : new PrismaBetterSqlite3({ url: DATABASE_URL });

  return new PrismaClient({ adapter });
}

// Next's dev server re-evaluates modules on every hot reload, and serverless
// runtimes reuse a warm process across invocations; without this the connection
// count climbs until the database starts refusing them.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
