import { describe, expect, it } from "vitest";
import { createResetToken, RESET_TTL_MS, verifyResetToken } from "@/lib/auth/reset-token";

describe("password reset tokens", () => {
  const user = "4b6f6f6b-0000-4000-8000-000000000001";
  const hash = "scrypt$salt$hash-v1";

  it("verifies a fresh token for the same password hash", () => {
    expect(verifyResetToken(createResetToken(user, hash), hash)).toBe(true);
  });

  it("stops working once the password has changed (single use)", () => {
    expect(verifyResetToken(createResetToken(user, hash), "scrypt$salt$hash-v2")).toBe(false);
  });

  it("expires after an hour", () => {
    const t = createResetToken(user, hash, 0);
    expect(verifyResetToken(t, hash, RESET_TTL_MS - 1)).toBe(true);
    expect(verifyResetToken(t, hash, RESET_TTL_MS + 1)).toBe(false);
  });

  it("rejects tampered or malformed tokens", () => {
    const [id, exp, sig] = createResetToken(user, hash).split(".");
    expect(verifyResetToken(`${id}.${Number(exp) + 1000}.${sig}`, hash)).toBe(false);
    expect(verifyResetToken(`${id}.${exp}.${sig.slice(0, -2)}xx`, hash)).toBe(false);
    expect(verifyResetToken("nonsense", hash)).toBe(false);
  });
});
