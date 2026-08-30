import { prisma } from "./db";
import { seedDatabase } from "./seed-data";

/**
 * Fills an empty database with the demo content on first request.
 *
 * This exists for one reason: deploying to a serverless host gives you no shell
 * to run `npm run db:seed` in, and a brand-new deployment showing an empty map
 * looks broken rather than new. It is off unless `ALLOW_AUTO_SEED=1`.
 *
 * Two guards make it safe to leave on for a demo deployment:
 *   - it only ever runs when the Activity table is completely empty, so it can
 *     never overwrite real submissions;
 *   - it never resets, so it cannot delete anything.
 *
 * Turn it off once the deployment holds data worth keeping.
 */

let attempted: Promise<void> | null = null;

async function run(): Promise<void> {
  try {
    const existing = await prisma.activity.count();
    if (existing > 0) return;

    console.log("Empty database and ALLOW_AUTO_SEED is set — seeding.");
    await seedDatabase(prisma, { reset: false });
  } catch (error) {
    // A failed seed must never take the page down with it; an empty map is a
    // better outcome than a 500.
    console.error("Auto-seed failed:", error);
  }
}

/**
 * Idempotent per process. Concurrent first requests all await the same attempt
 * rather than racing to insert the same 27 activities several times over.
 */
export function ensureSeeded(): Promise<void> {
  if (process.env.ALLOW_AUTO_SEED !== "1") return Promise.resolve();
  attempted ??= run();
  return attempted;
}
