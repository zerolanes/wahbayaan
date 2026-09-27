// Deletes the embedded development database and rebuilds it from migrations + seed.
import "./env";
import fs from "node:fs";
import { closeDb, getDb, pgliteDir } from "../src/lib/db/connect";
import { seedBase, seedDemo } from "./seed";

if (process.env.DATABASE_URL) {
  console.error("db:reset only works with the embedded PGlite database. Unset DATABASE_URL.");
  process.exit(1);
}
fs.rmSync(pgliteDir(), { recursive: true, force: true });
const db = await getDb();
await seedBase(db);
if (process.env.DEMO_MODE === "true" || process.argv.includes("--demo")) await seedDemo(db);
await closeDb();
console.log(`Database reset at ${pgliteDir()}.`);
