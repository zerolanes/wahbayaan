import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { notifyWaitlistAction, removeWaitlistEntryAction } from "@/app/actions/admin/waitlists";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextInput, Toggle } from "@/components/admin/controls";
import { Empty, ExportLink, FilterBar, FilterSelect, MiniStat, Panel, StatusBadge, TableCard, Thumb } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { waitlistEntries } from "@/lib/db/schema";
import { hrefWith, str } from "@/lib/admin/params";
import { query } from "@/lib/admin/sql";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Waitlists" };

type Row = {
  id: string;
  title: string;
  slug: string;
  status: string;
  availability: string;
  stock_qty: number;
  is_limited_drop: boolean;
  drop_starts_at: Date | null;
  edition_size: number | null;
  vendor: string;
  cover: string | null;
  waiting: number;
  notified: number;
  oldest: Date | null;
  last_notified: Date | null;
};

function state(r: Row, now = new Date()): { label: string; tone: "success" | "pending" | "neutral" | "warning" | "indigo"; ready: boolean } {
  if (r.status !== "active") return { label: `Listing ${r.status.replace("_", " ")}`, tone: "neutral", ready: false };
  if (r.is_limited_drop && r.drop_starts_at && new Date(r.drop_starts_at) > now) return { label: `Drop opens ${formatDate(r.drop_starts_at)}`, tone: "indigo", ready: false };
  if (r.availability === "ready_to_ship" && r.stock_qty <= 0) return { label: "Sold out", tone: "warning", ready: false };
  return { label: r.is_limited_drop ? "Drop live" : "Back in stock", tone: "success", ready: true };
}

export default async function WaitlistsPage(props: PageProps<"/admin/waitlists">) {
  await requireStaff("requests.manage");
  const params = await props.searchParams;
  const selected = str(params, "product");
  const show = str(params, "show");
  const d = await db();
  const rows = await query<Row>(sql`
    select p.id, p.title, p.slug, p.status, p.availability, p.stock_qty, p.is_limited_drop, p.drop_starts_at, p.edition_size, v.display_name as vendor,
      (select url from product_images i where i.product_id = p.id order by sort limit 1) as cover,
      count(*) filter (where w.notified_at is null)::int as waiting,
      count(*) filter (where w.notified_at is not null)::int as notified,
      min(w.created_at) filter (where w.notified_at is null) as oldest,
      max(w.notified_at) as last_notified
    from waitlist_entries w join products p on p.id = w.product_id join vendors v on v.id = p.vendor_id
    group by p.id, v.display_name
    order by waiting desc, p.title`);
  const withState = rows.map((r) => ({ ...r, st: state(r) }));
  const list = withState.filter((r) => (show === "ready" ? r.st.ready && r.waiting > 0 : show === "waiting" ? r.waiting > 0 : true));
  const entries = /^[0-9a-f-]{36}$/i.test(selected) ? await d.select().from(waitlistEntries).where(eq(waitlistEntries.productId, selected)).orderBy(asc(waitlistEntries.createdAt)) : [];
  const current = withState.find((r) => r.id === selected);
  const readyCount = withState.filter((r) => r.st.ready && r.waiting > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Waitlists"
        description="Buyers waiting for sold-out pieces and limited drops. “Notify now” queues one email per waiting buyer through the email outbox and marks them notified."
        actions={<ExportLink href={hrefWith("/admin/export/waitlists", params, {})} />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="People waiting" value={String(rows.reduce((a, r) => a + r.waiting, 0))} hint={`${rows.filter((r) => r.waiting > 0).length} pieces`} href="/admin/waitlists?show=waiting" />
        <MiniStat label="Ready to notify" value={String(readyCount)} tone={readyCount ? "pending" : undefined} hint="Back in stock or drop live" href="/admin/waitlists?show=ready" />
        <MiniStat label="Upcoming drops" value={String(withState.filter((r) => r.is_limited_drop && r.drop_starts_at && new Date(r.drop_starts_at) > new Date()).length)} />
        <MiniStat label="Already notified" value={String(rows.reduce((a, r) => a + r.notified, 0))} />
      </div>
      <FilterBar action="/admin/waitlists">
        <FilterSelect name="show" label="Show" value={show} options={[{ value: "waiting", label: "With people waiting" }, { value: "ready", label: "Ready to notify" }]} />
      </FilterBar>
      <TableCard toolbar={<p className="text-sm text-umber-600">{list.length} piece{list.length === 1 ? "" : "s"} with a waitlist</p>}>
        {list.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Piece</Th>
                <Th>Availability</Th>
                <Th className="text-right">Waiting</Th>
                <Th className="text-right">Notified</Th>
                <Th>Oldest sign-up</Th>
                <Th className="text-right">Notify</Th>
              </tr>
            </THead>
            <TBody>
              {list.map((r) => (
                <Tr key={r.id} className={r.id === selected ? "bg-umber-50" : undefined}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb src={r.cover} alt={r.title} size={40} kind={r.cover?.startsWith("/art/") ? "illustration" : "photo"} />
                      <div className="min-w-0">
                        <Link href={hrefWith("/admin/waitlists", params, { product: r.id })} className="font-medium text-umber-900 hover:underline">
                          {r.title}
                        </Link>
                        <p className="text-xs text-umber-500">
                          {r.vendor} ·{" "}
                          <Link href={`/admin/listings/${r.id}`} className="hover:underline">
                            listing
                          </Link>
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={r.st.tone}>{r.st.label}</Badge>
                    <p className="mt-0.5 text-xs text-umber-500">
                      {r.availability === "made_to_order" ? "Made to order" : `${r.stock_qty} in stock`}
                      {r.edition_size ? ` · edition of ${r.edition_size}` : ""}
                    </p>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">{r.waiting}</Td>
                  <Td className="text-right tabular-nums text-umber-600">{r.notified}</Td>
                  <Td className="text-sm text-umber-600">{r.oldest ? timeAgo(r.oldest) : "—"}</Td>
                  <Td className="text-right">
                    {r.waiting > 0 ? (
                      <ActionForm action={notifyWaitlistAction} confirm={`Email ${r.waiting} waiting buyer${r.waiting === 1 ? "" : "s"} about “${r.title}”?`} className="flex items-center justify-end gap-2">
                        <input type="hidden" name="productId" value={r.id} />
                        {!r.st.ready ? <Toggle name="force" label="send anyway" className="text-xs" /> : null}
                        <SubmitButton variant={r.st.ready ? "primary" : "outline"}>Notify now</SubmitButton>
                      </ActionForm>
                    ) : (
                      <span className="text-xs text-umber-400">{r.last_notified ? `Sent ${timeAgo(r.last_notified)}` : "—"}</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>{rows.length ? "Nothing matches this filter." : "No one is on a waitlist yet. Buyers can join from sold-out pieces and upcoming drops."}</Empty>
        )}
      </TableCard>

      {current ? (
        <Panel
          title={`Waitlist · ${current.title}`}
          description={`${entries.length} sign-up${entries.length === 1 ? "" : "s"}`}
          action={
            current.waiting > 0 ? (
              <ActionForm action={notifyWaitlistAction} inline confirm={`Email ${current.waiting} waiting buyer(s)?`} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="productId" value={current.id} />
                <div className="w-72">
                  <TextInput name="message" placeholder="Optional personal note in the email" aria-label="Message" />
                </div>
                {!current.st.ready ? <Toggle name="force" label="send anyway" /> : null}
                <SubmitButton variant="primary">Notify {current.waiting}</SubmitButton>
              </ActionForm>
            ) : null
          }
          bodyClassName="p-0"
        >
          <Table>
            <THead>
              <tr>
                <Th>Email</Th>
                <Th>Joined</Th>
                <Th>Notified</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {entries.map((w) => (
                <Tr key={w.id}>
                  <Td className="text-sm">
                    {w.userId ? (
                      <Link href={`/admin/customers/${w.userId}`} className="hover:underline">
                        {w.email}
                      </Link>
                    ) : (
                      w.email
                    )}
                  </Td>
                  <Td className="text-sm text-umber-600">{formatDateTime(w.createdAt)}</Td>
                  <Td>{w.notifiedAt ? <StatusBadge kind="email" status="sent" label={`Notified ${formatDate(w.notifiedAt)}`} /> : <Badge tone="pending">Waiting</Badge>}</Td>
                  <Td className="text-right">
                    <ActionButton action={removeWaitlistEntryAction} fields={{ id: w.id }} variant="ghost" confirm={`Remove ${w.email} from this waitlist?`}>
                      Remove
                    </ActionButton>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Panel>
      ) : null}
    </div>
  );
}
