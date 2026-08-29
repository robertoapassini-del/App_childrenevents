import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Points prisma/schema.prisma at whichever database DATABASE_URL names.
 *
 * Prisma resolves `datasource provider` at generate time and does not accept
 * env() there, so the one line has to be rewritten before `prisma generate`.
 * That's the whole reason this script exists.
 *
 * It is only safe because the schema was written to be portable: no Prisma
 * enums (SQLite has none) and no provider-specific column types, so the
 * generated client is equivalent either way. Adding a native type or an enum
 * to the schema would break that assumption — see README, "Portability".
 *
 * Runs automatically from `npm run build` and `npm run db:generate`.
 */

const SCHEMA = "prisma/schema.prisma";

export function providerFor(url) {
  if (!url) return "sqlite";
  if (/^postgres(ql)?:\/\//i.test(url)) return "postgresql";
  if (/^file:/i.test(url)) return "sqlite";
  throw new Error(
    `DATABASE_URL uses an unsupported scheme: ${url.split(":")[0]}:. Expected file: or postgresql:.`,
  );
}

/** Rewrite only the datasource block's provider, never the generator's. */
export function applyProvider(schema, provider) {
  return schema.replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")[^"]+(")/s,
    `$1${provider}$2`,
  );
}

function main() {
  const provider = providerFor(process.env.DATABASE_URL);
  const schema = readFileSync(SCHEMA, "utf8");
  const updated = applyProvider(schema, provider);

  if (updated !== schema) {
    writeFileSync(SCHEMA, updated);
    console.log(`schema.prisma: datasource provider -> ${provider}`);
  } else {
    console.log(`schema.prisma: datasource provider already ${provider}`);
  }
}

// Only touch the schema when run as a script — importing this module (from a
// test, say) must not rewrite the file underneath you.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
