import "server-only";
import { getDb } from "./connect";

export type { Db } from "./connect";

/**
 * Lazily-connected database handle. Importing this module never opens a connection;
 * the first query does.
 */
export async function db() {
  return getDb();
}
