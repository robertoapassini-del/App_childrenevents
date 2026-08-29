import { prisma } from "../lib/db";
import { seedDatabase } from "../lib/seed-data";

/** CLI entry point: `npm run db:seed`. Clears and repopulates the database. */
seedDatabase(prisma)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
