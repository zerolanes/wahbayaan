import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { SearchParams } from "./params";

/** Route-handler guard: returns the staff user, or a Response to send back. */
export async function staffForRoute(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") return { error: new Response("Sign in as staff to export.", { status: 401 }) } as const;
  if (!user.permissions.has(permission)) return { error: new Response(`Missing permission: ${permission}`, { status: 403 }) } as const;
  return { user } as const;
}

export function paramsOf(req: Request): SearchParams {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}

export function stamp() {
  return new Date().toISOString().slice(0, 10);
}
