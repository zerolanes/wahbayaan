import { desc } from "drizzle-orm";
import { createAnnouncementAction, deleteAnnouncementAction, toggleAnnouncementAction, updateAnnouncementAction } from "@/app/actions/admin/content";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput, Toggle } from "@/components/admin/controls";
import { Empty, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { announcements } from "@/lib/db/schema";
import { windowState, type WindowState } from "@/lib/admin/content";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Announcements" };

const TONE: Record<WindowState, "success" | "indigo" | "neutral"> = { live: "success", scheduled: "indigo", ended: "neutral", off: "neutral" };
const dt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16) : "");

function Fields({ a }: { a?: typeof announcements.$inferSelect }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FieldRow label="Message" className="md:col-span-2" hint="One short line, e.g. “Free gift wrap on every order this month”.">
        <TextInput name="message" defaultValue={a?.message ?? ""} maxLength={200} required />
      </FieldRow>
      <FieldRow label="Link (optional)" className="md:col-span-2" hint="A site path like /shop or a full https:// link.">
        <TextInput name="link" defaultValue={a?.link ?? ""} placeholder="/drops" />
      </FieldRow>
      <FieldRow label="Starts (UTC)" hint="Empty = as soon as it's on.">
        <TextInput type="datetime-local" name="startsAt" defaultValue={dt(a?.startsAt)} />
      </FieldRow>
      <FieldRow label="Ends (UTC)" hint="Empty = until switched off.">
        <TextInput type="datetime-local" name="endsAt" defaultValue={dt(a?.endsAt)} />
      </FieldRow>
      <Toggle name="isActive" label="Switched on" defaultChecked={a?.isActive ?? true} />
    </div>
  );
}

export default async function AnnouncementsPage() {
  await requireStaff("marketing.manage");
  const d = await db();
  const rows = await d.select().from(announcements).orderBy(desc(announcements.createdAt));
  const now = new Date();
  const list = rows.map((a) => ({ ...a, state: windowState(a, now) }));
  const live = list.filter((a) => a.state === "live");
  // The storefront shows the newest live banner only.
  const showing = live[0];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="Announcements" description="The banner above the storefront header. One shows at a time — the newest that is switched on and inside its dates." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Showing now" value={showing ? "1" : "0"} hint={showing ? showing.message : "No banner on the site"} />
        <MiniStat label="Scheduled" value={String(list.filter((a) => a.state === "scheduled").length)} />
        <MiniStat label="Switched on but hidden" value={String(Math.max(0, live.length - 1))} tone={live.length > 1 ? "pending" : undefined} hint="Older live banners are overshadowed" />
        <MiniStat label="Total" value={String(rows.length)} />
      </div>
      {showing ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-umber-500">Live preview</p>
          <div className="rounded-lg bg-indigo-950 px-4 py-2 text-center text-sm text-sand-50">
            {showing.message}
            {showing.link ? " →" : ""}
          </div>
        </div>
      ) : (
        <Notice tone="indigo" title="No banner is showing">
          Create one below or switch an existing one on.
        </Notice>
      )}
      <TableCard>
        {list.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Message</Th>
                <Th>Window (UTC)</Th>
                <Th>State</Th>
                <Th className="text-right" />
              </tr>
            </THead>
            <TBody>
              {list.map((a) => (
                <Tr key={a.id} className="align-top">
                  <Td className="max-w-xl">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-umber-900">
                        {a.message}
                        {a.link ? <span className="ml-2 text-xs font-normal text-umber-500">→ {a.link}</span> : null}
                        {a.id === showing?.id ? <Badge tone="success" className="ml-2">On the site</Badge> : null}
                      </summary>
                      <ActionForm action={updateAnnouncementAction} inline className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={a.id} />
                        <Fields a={a} />
                        <div className="flex gap-2">
                          <SubmitButton>Save</SubmitButton>
                        </div>
                      </ActionForm>
                      <ActionButton action={deleteAnnouncementAction} fields={{ id: a.id }} variant="ghost" confirm="Delete this announcement?" className="mt-1">
                        Delete
                      </ActionButton>
                    </details>
                  </Td>
                  <Td className="text-sm whitespace-nowrap text-umber-600">
                    {a.startsAt ? formatDateTime(a.startsAt) : "Any time"} → {a.endsAt ? formatDateTime(a.endsAt) : "no end"}
                  </Td>
                  <Td>
                    <Badge tone={TONE[a.state]}>{a.state}</Badge>
                  </Td>
                  <Td className="text-right">
                    <ActionButton action={toggleAnnouncementAction} fields={{ id: a.id }} variant="ghost">
                      {a.isActive ? "Switch off" : "Switch on"}
                    </ActionButton>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No announcements yet.</Empty>
        )}
      </TableCard>
      <Panel title="New announcement">
        <ActionForm action={createAnnouncementAction} inline resetOnSuccess className="space-y-4">
          <Fields />
          <SubmitButton variant="primary">Create</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
