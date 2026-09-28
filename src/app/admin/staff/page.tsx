import { asc, eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { changeStaffRoleAction, deleteRoleAction, inviteStaffAction, resetStaffPasswordAction, saveRoleAction, saveRoleMatrixAction, setStaffStatusAction } from "@/app/actions/admin/staff";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { DemoBadge, Empty, FilterBar, FilterSelect, MiniStat, Panel, SectionTitle, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { staffRoles, users } from "@/lib/db/schema";
import { str } from "@/lib/admin/params";
import { groupPermissions, MANAGE, staffManagers } from "@/lib/admin/staff-rules";
import { humanize } from "@/lib/admin/labels";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage(props: PageProps<"/admin/staff">) {
  const me = await requireStaff("staff.manage");
  const params = await props.searchParams;
  const d = await db();
  const [staff, roles] = await Promise.all([
    d
      .select({ id: users.id, name: users.name, email: users.email, status: users.status, staffRoleId: users.staffRoleId, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, isDemo: users.isDemo })
      .from(users)
      .where(eq(users.role, "staff"))
      .orderBy(asc(users.name)),
    d.select().from(staffRoles).orderBy(asc(staffRoles.createdAt), asc(staffRoles.name)),
  ]);
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "No role";
  const managers = new Set(staffManagers(staff, roles));
  const f = { q: str(params, "q").toLowerCase(), role: str(params, "role"), status: str(params, "status") };
  const rows = staff.filter((s) => (!f.q || `${s.name} ${s.email}`.toLowerCase().includes(f.q)) && (!f.role || s.staffRoleId === f.role) && (!f.status || s.status === f.status));
  const active = staff.filter((s) => s.status === "active");
  const neverSignedIn = active.filter((s) => !s.lastLoginAt).length;
  const members = (roleId: string) => staff.filter((s) => s.staffRoleId === roleId);
  const groups = groupPermissions(ALL_PERMISSIONS);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Staff & roles" description="Who can sign in to the admin and what each role may do. Every change is audited; the last person able to manage staff can't be removed." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Active staff" value={String(active.length)} hint={`${staff.length - active.length} deactivated`} />
        <MiniStat label="Never signed in" value={String(neverSignedIn)} hint="Invited, password not used yet" tone={neverSignedIn ? "pending" : undefined} />
        <MiniStat label="Roles" value={String(roles.length)} hint={`${roles.filter((r) => !members(r.id).length).length} without members`} />
        <MiniStat label="Can manage staff" value={String(managers.size)} hint={[...managers].map((id) => staff.find((s) => s.id === id)?.name).join(", ")} />
      </div>

      <FilterBar action="/admin/staff" q={str(params, "q")} placeholder="Name or email">
        <FilterSelect name="role" label="Role" value={f.role} options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        <FilterSelect name="status" label="Status" value={f.status} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Deactivated" }]} />
      </FilterBar>

      <TableCard toolbar={<p className="text-sm text-umber-600">{rows.length} staff member{rows.length === 1 ? "" : "s"}</p>}>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th>Added</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map((s) => (
                <EditRow
                  key={s.id}
                  colSpan={5}
                  label="Manage"
                  cells={
                    <>
                      <Td>
                        <p className="flex items-center gap-1.5 font-medium text-umber-900">
                          {s.name} {s.id === me.id ? <Badge tone="neutral">You</Badge> : null} <DemoBadge show={s.isDemo} />
                        </p>
                        <p className="text-xs text-umber-500">{s.email}</p>
                      </Td>
                      <Td>
                        {roleName(s.staffRoleId)}
                        {managers.has(s.id) ? <p className="text-xs text-umber-500">Can manage staff</p> : null}
                      </Td>
                      <Td>
                        <StatusBadge kind="account" status={s.status} label={s.status === "active" ? "Active" : "Deactivated"} />
                      </Td>
                      <Td className="text-xs whitespace-nowrap text-umber-600" title={s.lastLoginAt ? formatDateTime(s.lastLoginAt) : undefined}>
                        {s.lastLoginAt ? timeAgo(s.lastLoginAt) : <Badge tone="pending">Never</Badge>}
                      </Td>
                      <Td className="text-xs whitespace-nowrap text-umber-500">{formatDate(s.createdAt)}</Td>
                    </>
                  }
                  editor={
                    <div className="flex flex-wrap items-end gap-3">
                      <ActionForm action={changeStaffRoleAction} className="flex items-end gap-2">
                        <input type="hidden" name="userId" value={s.id} />
                        <FieldRow label="Role">
                          <SelectInput name="roleId" defaultValue={s.staffRoleId ?? ""} className="w-52">
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </SelectInput>
                        </FieldRow>
                        <SubmitButton>Change role</SubmitButton>
                      </ActionForm>
                      <div className="ml-auto flex flex-wrap gap-2">
                        <ActionButton action={resetStaffPasswordAction} fields={{ userId: s.id }} confirm={`Reset ${s.name}'s password? They will be signed out everywhere.`}>
                          Reset password
                        </ActionButton>
                        {s.id !== me.id ? (
                          s.status === "active" ? (
                            <ActionButton action={setStaffStatusAction} fields={{ userId: s.id, status: "suspended" }} variant="danger" confirm={`Deactivate ${s.name}? They will be signed out immediately.`}>
                              Deactivate
                            </ActionButton>
                          ) : (
                            <ActionButton action={setStaffStatusAction} fields={{ userId: s.id, status: "active" }}>
                              Reactivate
                            </ActionButton>
                          )
                        ) : null}
                      </div>
                    </div>
                  }
                />
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>{staff.length ? "No staff match these filters." : "No staff yet."}</Empty>
        )}
      </TableCard>

      <Panel title="Invite a staff member" description="Creates the account and emails a temporary password (also shown once here). Use a work email — buyer and artisan accounts can't be staff.">
        <ActionForm action={inviteStaffAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <FieldRow label="Name">
            <TextInput name="name" required className="w-56" />
          </FieldRow>
          <FieldRow label="Email">
            <TextInput name="email" type="email" required className="w-64" />
          </FieldRow>
          <FieldRow label="Role">
            <SelectInput name="roleId" required defaultValue={roles.find((r) => r.name === "Support")?.id ?? roles[0]?.id} className="w-52">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <SubmitButton>Send invite</SubmitButton>
        </ActionForm>
      </Panel>

      <section id="roles" className="scroll-mt-24 space-y-3">
        <SectionTitle>Roles</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} data-slot="card" className="rounded-[var(--radius-card)] border border-umber-200 bg-white">
              <details>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-umber-900">
                      {r.name} {r.isSystem ? <Lock className="size-3.5 text-umber-400" aria-label="System role" /> : null}
                    </p>
                    <p className="text-xs text-umber-500">{r.description ?? "No description"}</p>
                    <p className="mt-2 text-xs text-umber-600">
                      {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"} · {members(r.id).length} member{members(r.id).length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-xs text-umber-500">Edit</span>
                </summary>
                <div className="space-y-3 border-t border-umber-200 p-4">
                  <ActionForm action={saveRoleAction} className="space-y-3">
                    <input type="hidden" name="id" value={r.id} />
                    {r.permissions.map((p) => (
                      <input key={p} type="hidden" name="permissions[]" value={p} />
                    ))}
                    <FieldRow label="Name">
                      <TextInput name="name" defaultValue={r.name} required />
                    </FieldRow>
                    <FieldRow label="Description">
                      <TextInput name="description" defaultValue={r.description ?? ""} />
                    </FieldRow>
                    <SubmitButton>Save role</SubmitButton>
                  </ActionForm>
                  {!r.isSystem ? (
                    <ActionButton action={deleteRoleAction} fields={{ id: r.id }} variant="ghost" confirm={`Delete the ${r.name} role?`}>
                      Delete role
                    </ActionButton>
                  ) : (
                    <p className="text-xs text-umber-500">The Owner role always has every permission and can't be deleted.</p>
                  )}
                </div>
              </details>
            </div>
          ))}
        </div>
      </section>

      <Panel title="Permission matrix" description="Tick what each role may do, then save once. Owner is locked to every permission." bodyClassName="p-0">
        <ActionForm action={saveRoleMatrixAction}>
          {roles.map((r) => (
            <input key={r.id} type="hidden" name="roles[]" value={r.id} />
          ))}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-umber-200 text-left text-xs text-umber-500">
                  <th className="px-5 py-2.5 font-medium">Permission</th>
                  {roles.map((r) => (
                    <th key={r.id} className="px-2 py-2.5 text-center font-medium whitespace-nowrap">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.area} area={g.area} keys={g.keys} roles={roles} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-umber-200 px-5 py-3">
            <p className="text-xs text-umber-500">
              <code>{MANAGE}</code> must stay with at least one active staff member.
            </p>
            <SubmitButton confirm="Save permission changes for all roles?">Save permissions</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Create a role" description="Start with a name; set permissions in the matrix above.">
        <ActionForm action={saveRoleAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <FieldRow label="Name">
            <TextInput name="name" required className="w-56" placeholder="e.g. Logistics" />
          </FieldRow>
          <FieldRow label="Description" className="min-w-72 flex-1">
            <TextInput name="description" />
          </FieldRow>
          <SubmitButton>Create role</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}

function GroupRows({ area, keys, roles }: { area: string; keys: string[]; roles: (typeof staffRoles.$inferSelect)[] }) {
  return (
    <>
      <tr className="bg-umber-50">
        <td colSpan={roles.length + 1} className="px-5 py-1.5 text-xs font-semibold tracking-wide text-umber-500 uppercase">
          {humanize(area)}
        </td>
      </tr>
      {keys.map((p) => (
        <tr key={p} className="border-t border-umber-200/60 hover:bg-umber-50/60">
          <td className="px-5 py-2">
            <p className="text-umber-900">{PERMISSIONS[p as keyof typeof PERMISSIONS]}</p>
            <code className="text-xs text-umber-500">{p}</code>
          </td>
          {roles.map((r) => (
            <td key={r.id} className="px-2 py-2 text-center">
              <input
                type="checkbox"
                name={`perm:${r.id}`}
                value={p}
                defaultChecked={r.isSystem || r.permissions.includes(p)}
                disabled={r.isSystem}
                aria-label={`${r.name}: ${p}`}
                className="size-4 accent-indigo-800"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
