import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

// Prisma 7 connects through a driver adapter rather than a URL in the schema.
// Swapping to Postgres means swapping this adapter for @prisma/adapter-pg and
// changing the provider in schema.prisma — nothing else in the app changes.
function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });
}

// Next's dev server re-evaluates modules on every hot reload; without this the
// connection count climbs until SQLite starts refusing them.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
