import "server-only";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { assertStaff, type CurrentUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import type { ActionState } from "./action-state";
import { firstIssue, formToObject } from "./zod";

/** An error whose message is safe to show to staff as-is. */
export class AdminError extends Error {}

type Ctx<T> = { user: CurrentUser; data: T; formData: FormData };

/**
 * Standard admin mutation: check permission → validate → run → refresh.
 * The handler records its own audit entry (`ctx.audit`) with a precise summary.
 */
export function adminAction<S extends z.ZodType>(
  permission: Permission,
  schema: S,
  handler: (ctx: Ctx<z.output<S>> & { audit: (e: AuditEntry) => Promise<void> }) => Promise<ActionState | void>,
) {
  return async function action(_prev: ActionState, formData: FormData): Promise<ActionState> {
    let user: CurrentUser;
    try {
      user = await assertStaff(permission);
    } catch {
      return { error: `Your role doesn't include the “${permission}” permission.`, at: Date.now() };
    }
    const parsed = schema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssue(parsed.error), at: Date.now() };
    try {
      const result = await handler({
        user,
        data: parsed.data,
        formData,
        audit: (e) => audit({ actorUserId: user.id, ...e }),
      });
      refresh();
      return { ok: true, message: "Saved", ...(result ?? {}), at: Date.now() };
    } catch (err) {
      unstable_rethrow(err);
      return { error: describeError(err), at: Date.now() };
    }
  };
}

export function describeError(err: unknown): string {
  const code = pgCode(err);
  if (code === "23505") return "That value is already in use — it must be unique.";
  if (code === "23503") return "This record is still referenced elsewhere, so it can't be removed.";
  if (code === "22P02") return "One of the values has an invalid format.";
  if (err instanceof AdminError || (err instanceof Error && err.constructor.name === "OrderError")) return err.message;
  console.error("[admin action]", err);
  if (err instanceof Error && !/query|sql|relation|column/i.test(err.message)) return err.message;
  return "Something went wrong. Please try again.";
}

function pgCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export type AuditEntry = { action: string; entity: string; entityId?: string | null; summary: string; data?: unknown };

export function files(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
}
