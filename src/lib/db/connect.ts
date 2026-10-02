/**
 * Database connection shared by the Next.js app and the CLI scripts.
 *
 * - `DATABASE_URL` set   → real Postgres through postgres-js (production).
 * - `DATABASE_URL` empty → embedded PGlite (Postgres compiled to WASM) stored in
 *   `PGLITE_DIR`, so development needs no database server.
 *
 * PGlite is single-process: only one process may open the data directory at a
 * time. A pid lock file guards against running a script while `next dev` is up.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

type Holder = { db?: Promise<Db>; close?: () => Promise<void> };
const globalHolder = globalThis as unknown as { __wahbayaanDb?: Holder };
const holder: Holder = (globalHolder.__wahbayaanDb ??= {});

const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

export function pgliteDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.PGLITE_DIR || ".data/pglite");
}

function lockPath() {
  return `${pgliteDir()}.lock`;
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Our own parent processes (e.g. the `tsx` or `npm` wrapper) never count as another holder. */
function isAncestor(pid: number) {
  let current = process.ppid;
  for (let depth = 0; current > 1 && depth < 16; depth++) {
    if (current === pid) return true;
    try {
      // /proc/<pid>/stat: "pid (comm) state ppid ..."; comm may contain spaces.
      const stat = fs.readFileSync(`/proc/${current}/stat`, "utf8");
      current = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
    } catch {
      break;
    }
  }
  return false;
}

/**
 * The lock records "pid@host". It lives next to the data (on a persistent
 * volume in production), so a lock written by another machine or container is
 * stale: process numbers are reused across containers.
 */
export function lockIsHeld(content: string, host = os.hostname()) {
  const [pidText, owner] = content.trim().split("@");
  const pid = Number(pidText);
  if (!pid || pid === process.pid) return false;
  if (owner !== undefined && owner !== host) return false;
  return isPidAlive(pid) && !isAncestor(pid);
}

function acquireLock() {
  const file = lockPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    if (lockIsHeld(content)) {
      throw new Error(
        `The embedded database at ${pgliteDir()} is in use by process ${content.trim()} (probably \`next dev\`). ` +
          "Stop it before running database scripts, or set PGLITE_DIR to a different directory.",
      );
    }
  }
  const mine = `${process.pid}@${os.hostname()}`;
  fs.writeFileSync(file, mine);
  const release = () => {
    try {
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === mine) fs.unlinkSync(file);
    } catch {
      // best effort
    }
  };
  process.once("exit", release);
  return release;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 10 });
    const db = drizzle(client, { schema });
    if (process.env.AUTO_MIGRATE !== "false") await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    holder.close = async () => {
      await client.end();
    };
    return db;
  }

  const release = acquireLock();
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  fs.mkdirSync(pgliteDir(), { recursive: true });
  const client = await PGlite.create(pgliteDir());
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  holder.close = async () => {
    await client.close();
    release();
  };
  // The PGlite and postgres-js drivers expose the same query builder API.
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  holder.db ??= connect().catch((err) => {
    holder.db = undefined;
    throw err;
  });
  return holder.db;
}

export async function closeDb() {
  if (holder.close) await holder.close();
  holder.db = undefined;
  holder.close = undefined;
}
