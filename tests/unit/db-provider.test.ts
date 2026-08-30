import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyProvider, providerFor } from "@/scripts/sync-db-provider.mjs";
import { isPostgres } from "@/lib/db";

/**
 * The one line that has to agree between the runtime driver adapter and the
 * Prisma schema. If these two disagree the app builds fine and then fails at
 * the first query, so it's worth pinning down.
 */

describe("providerFor", () => {
  it("maps a SQLite file URL to sqlite", () => {
    expect(providerFor("file:./prisma/dev.db")).toBe("sqlite");
  });

  it("maps both Postgres URL spellings to postgresql", () => {
    expect(providerFor("postgresql://user:pw@host:5432/db")).toBe("postgresql");
    expect(providerFor("postgres://user:pw@host:5432/db")).toBe("postgresql");
  });

  it("handles a hosted URL with query parameters", () => {
    expect(
      providerFor("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db?sslmode=require"),
    ).toBe("postgresql");
  });

  it("defaults to sqlite when nothing is set, matching lib/db's fallback", () => {
    expect(providerFor(undefined)).toBe("sqlite");
    expect(providerFor("")).toBe("sqlite");
  });

  it("refuses a scheme it can't support rather than guessing", () => {
    expect(() => providerFor("mysql://user@host/db")).toThrow(/unsupported scheme/i);
  });
});

describe("providerFor agrees with the runtime adapter choice", () => {
  it.each([
    "file:./prisma/dev.db",
    "postgresql://user:pw@host:5432/db",
    "postgres://user:pw@host:5432/db",
  ])("%s", (url) => {
    // isPostgres picks the driver adapter; providerFor picks the schema
    // provider. They must never disagree about the same URL.
    expect(isPostgres(url)).toBe(providerFor(url) === "postgresql");
  });
});

describe("applyProvider", () => {
  const schema = readFileSync(
    path.join(import.meta.dirname, "..", "..", "prisma", "schema.prisma"),
    "utf8",
  );

  it("rewrites the datasource provider", () => {
    const updated: string = applyProvider(schema, "postgresql");
    expect(updated).toMatch(/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/s);
  });

  it("leaves the generator's provider alone", () => {
    const updated: string = applyProvider(schema, "postgresql");
    expect(updated).toContain('provider = "prisma-client-js"');
  });

  it("round-trips back to sqlite", () => {
    const there: string = applyProvider(schema, "postgresql");
    const back: string = applyProvider(there, "sqlite");
    expect(back).toBe(applyProvider(schema, "sqlite"));
  });

  it("changes exactly one line", () => {
    const updated: string = applyProvider(schema, "postgresql");
    const before = schema.split("\n");
    const after = updated.split("\n");
    const differing = before.filter((line, i) => line !== after[i]);
    expect(differing.length).toBeLessThanOrEqual(1);
  });
});

describe("the schema stays portable", () => {
  const schema = readFileSync(
    path.join(import.meta.dirname, "..", "..", "prisma", "schema.prisma"),
    "utf8",
  );

  it("declares no Prisma enums, which SQLite cannot represent", () => {
    // Adding one would silently break the SQLite side of the provider switch.
    expect(schema).not.toMatch(/^\s*enum\s+\w+\s*\{/m);
  });

  it("uses no provider-specific native column types", () => {
    expect(schema).not.toMatch(/@db\./);
  });
});
