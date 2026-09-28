/**
 * Safety rules for staff and role changes, kept pure so they can be tested:
 * the company must never lose its last active staff member who can manage
 * staff (otherwise nobody could fix roles again without database access).
 */
export type StaffLite = { id: string; status: "active" | "suspended"; staffRoleId: string | null };
export type RoleLite = { id: string; permissions: string[] };

export const MANAGE = "staff.manage";

export function staffManagers(staff: readonly StaffLite[], roles: readonly RoleLite[]): string[] {
  const perms = new Map(roles.map((r) => [r.id, r.permissions]));
  return staff.filter((s) => s.status === "active" && s.staffRoleId && (perms.get(s.staffRoleId) ?? []).includes(MANAGE)).map((s) => s.id);
}

export type StaffChange =
  | { kind: "user"; userId: string; staffRoleId?: string | null; status?: "active" | "suspended" }
  | { kind: "role"; roleId: string; permissions: string[] }
  | { kind: "roles"; permissions: Record<string, string[]> };

/** Returns an error message if the change would leave nobody able to manage staff. */
export function checkStaffChange(staff: readonly StaffLite[], roles: readonly RoleLite[], change: StaffChange): string | null {
  const nextStaff = change.kind === "user" ? staff.map((s) => (s.id === change.userId ? { ...s, ...(change.staffRoleId !== undefined ? { staffRoleId: change.staffRoleId } : {}), ...(change.status ? { status: change.status } : {}) } : s)) : staff;
  const nextRoles =
    change.kind === "role"
      ? roles.map((r) => (r.id === change.roleId ? { ...r, permissions: change.permissions } : r))
      : change.kind === "roles"
        ? roles.map((r) => (change.permissions[r.id] ? { ...r, permissions: change.permissions[r.id] } : r))
        : roles;
  if (staffManagers(staff, roles).length && !staffManagers(nextStaff, nextRoles).length) {
    return "This would leave no active staff member who can manage staff and roles. Give someone else the “staff.manage” permission first.";
  }
  return null;
}

/** Group permission keys by their area ("orders.view" → "orders"). */
export function groupPermissions<T extends string>(keys: readonly T[]): { area: string; keys: T[] }[] {
  const out: { area: string; keys: T[] }[] = [];
  for (const k of keys) {
    const area = k.split(".")[0];
    const g = out.find((x) => x.area === area);
    if (g) g.keys.push(k);
    else out.push({ area, keys: [k] });
  }
  return out;
}
