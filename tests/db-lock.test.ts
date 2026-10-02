import os from "node:os";
import { describe, expect, it } from "vitest";
import { lockIsHeld } from "@/lib/db/connect";

describe("embedded database lock", () => {
  const host = os.hostname();

  it("treats a lock from another machine or container as stale", () => {
    expect(lockIsHeld(`${process.ppid}@some-old-container`, host)).toBe(false);
  });

  it("ignores our own process and our parent wrappers", () => {
    expect(lockIsHeld(`${process.pid}@${host}`, host)).toBe(false);
    expect(lockIsHeld(`${process.ppid}@${host}`, host)).toBe(false);
  });

  it("ignores dead processes and junk", () => {
    expect(lockIsHeld(`999999@${host}`, host)).toBe(false);
    expect(lockIsHeld("", host)).toBe(false);
  });

  it("respects a live unrelated process on this machine", () => {
    // PID 1 is alive and is never one of our ancestors' parents in the walk (it stops at 1).
    expect(lockIsHeld(`1@${host}`, host)).toBe(true);
  });
});
