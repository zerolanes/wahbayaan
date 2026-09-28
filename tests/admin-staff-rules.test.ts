import { describe, expect, it } from "vitest";
import { checkStaffChange, groupPermissions, staffManagers } from "@/lib/admin/staff-rules";

const roles = [
  { id: "owner", permissions: ["staff.manage", "orders.view"] },
  { id: "ops", permissions: ["orders.view"] },
];
const staff = [
  { id: "a", status: "active" as const, staffRoleId: "owner" },
  { id: "b", status: "active" as const, staffRoleId: "ops" },
  { id: "c", status: "suspended" as const, staffRoleId: "owner" },
];

describe("staff safety rules", () => {
  it("counts only active members whose role grants staff.manage", () => {
    expect(staffManagers(staff, roles)).toEqual(["a"]);
  });
  it("blocks demoting, deactivating or stripping the last manager", () => {
    expect(checkStaffChange(staff, roles, { kind: "user", userId: "a", staffRoleId: "ops" })).toMatch(/no active staff/);
    expect(checkStaffChange(staff, roles, { kind: "user", userId: "a", status: "suspended" })).toMatch(/no active staff/);
    expect(checkStaffChange(staff, roles, { kind: "role", roleId: "owner", permissions: ["orders.view"] })).toMatch(/no active staff/);
    expect(checkStaffChange(staff, roles, { kind: "roles", permissions: { owner: [] } })).toMatch(/no active staff/);
  });
  it("allows changes that keep someone able to manage staff", () => {
    expect(checkStaffChange(staff, roles, { kind: "user", userId: "b", staffRoleId: "owner" })).toBeNull();
    expect(checkStaffChange(staff, roles, { kind: "user", userId: "c", status: "active" })).toBeNull();
    expect(checkStaffChange(staff, roles, { kind: "roles", permissions: { ops: ["staff.manage"], owner: [] } })).toBeNull();
  });
  it("groups permissions by area in order", () => {
    expect(groupPermissions(["orders.view", "orders.manage", "rates.view"])).toEqual([
      { area: "orders", keys: ["orders.view", "orders.manage"] },
      { area: "rates", keys: ["rates.view"] },
    ]);
  });
});
