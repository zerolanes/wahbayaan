// Applies pending migrations (connecting runs them).
import "./env";
import { closeDb, getDb } from "../src/lib/db/connect";

await getDb();
await closeDb();
console.log("Migrations applied.");
