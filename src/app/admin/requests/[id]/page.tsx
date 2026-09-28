import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { linkRequestOrderAction, matchRequestAction, requestStatusAction, staffQuoteAction } from "@/app/actions/admin/requests";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { BuyerEquivalent, toPkrToday } from "@/components/admin/fx-amount";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DetailGrid, KV, OrderAmount, Panel, PendingBadge, StatusBadge, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { customRequests, orders, users, vendors } from "@/lib/db/schema";
import { getFxTable } from "@/lib/commerce/rates";
import { minorToInput } from "@/lib/admin/money";
import { requestSla } from "@/lib/admin/sla";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Custom request" };

export default async function RequestDetail(props: PageProps<"/admin/requests/[id]">) {
  const staff = await requireStaff("requests.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const r = await d.query.customRequests.findFirst({ where: eq(customRequests.id, id), with: { vendor: true, category: true, product: true } });
  if (!r) notFound();
  const [fx, artisans, customer, order] = await Promise.all([
    getFxTable(),
    d
      .select({
        id: vendors.id,
        name: vendors.displayName,
        craft: vendors.craft,
        city: vendors.workshopCity,
        categoryId: vendors.primaryCategoryId,
        accepts: vendors.acceptsCustomOrders,
        vacation: vendors.vacationMode,
        responseHours: vendors.responseTimeHours,
        open: sql<number>`(select count(*)::int from custom_requests x where x.vendor_id = "vendors"."id" and x.status in ('new','quoted','accepted'))`,
      })
      .from(vendors)
      .where(eq(vendors.status, "verified"))
      .orderBy(asc(vendors.displayName)),
    r.userId ? d.query.users.findFirst({ where: eq(users.id, r.userId) }) : d.query.users.findFirst({ where: and(eq(sql`lower(${users.email})`, r.email.toLowerCase()), eq(users.role, "buyer")) }),
    r.orderId ? d.query.orders.findFirst({ where: eq(orders.id, r.orderId) }) : null,
  ]);
  const cur = r.budgetCurrency ?? DESTINATIONS.find((x) => x.code === r.destinationCountry)?.currency ?? "USD";
  const sla = requestSla({ ...r, matched: !!r.vendorId });
  const budgetPkr = r.budget != null ? toPkrToday(r.budget, cur, fx) : null;
  const suggested = artisans.filter((a) => a.accepts && !a.vacation).sort((a, b) => Number(b.categoryId === r.categoryId) - Number(a.categoryId === r.categoryId) || a.open - b.open);
  const unavailable = artisans.filter((a) => !a.accepts || a.vacation);
  const closed = ["declined", "expired", "cancelled", "converted"].includes(r.status);

  const main = (
    <>
      {sla.tone === "danger" || sla.tone === "warning" ? (
        <Notice tone={sla.tone === "danger" ? "danger" : "pending"} title={sla.note}>
          Opened {formatDateTime(r.createdAt)} ({sla.label} ago).{!r.vendorId ? " Match it to an artisan in the side panel." : ""}
        </Notice>
      ) : null}
      <Panel title="The brief" description={`${r.category?.name ?? "No category"}${r.product ? ` · based on “${r.product.title}”` : ""}`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-umber-900">{r.details}</p>
        <KV
          className="mt-4"
          items={[
            ["Text to include", r.customText ?? "—"],
            ["Size", r.sizeNotes ?? "—"],
            ["Colours", r.colorNotes ?? "—"],
            ["Ship to", destinationName(r.destinationCountry)],
            [
              "Budget",
              r.budget != null ? (
                <span key="b">
                  <OrderAmount amount={r.budget} currency={cur} /> {budgetPkr != null ? <span className="text-umber-500">(≈ <SellerPrice pkr={budgetPkr} /> today)</span> : <PendingBadge>{cur} rate pending</PendingBadge>}
                </span>
              ) : (
                "Not given"
              ),
            ],
          ]}
        />
        {r.referenceImageUrls.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {r.referenceImageUrls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                <Thumb src={u} alt="Reference image from the buyer" size={88} />
              </a>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel title="Quote" description="Artisans quote in PKR; the buyer sees it converted at the live rate.">
        {r.quotePkr != null ? (
          <KV
            items={[
              ["Artisan price", <SellerPrice key="p" pkr={r.quotePkr} className="font-medium" />],
              [`In ${cur} (today)`, <BuyerEquivalent key="e" pkr={r.quotePkr} currency={cur} fx={fx} />],
              ["Time to make", r.quoteDays ? `${r.quoteDays} days` : "—"],
              ["Quoted", r.quotedAt ? formatDateTime(r.quotedAt) : "—"],
              ["Message", r.quoteMessage ?? "—"],
            ]}
          />
        ) : (
          <p className="text-sm text-umber-500">{r.vendorId ? `Waiting for ${r.vendor?.displayName} to quote.` : "No artisan matched yet."}</p>
        )}
        {r.vendorId && !closed ? (
          <details className="mt-4 rounded-lg border border-umber-200 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-umber-800">{r.quotePkr != null ? "Revise the quote" : "Record a quote on the artisan's behalf"}</summary>
            <ActionForm action={staffQuoteAction} inline className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={r.id} />
              <FieldRow label="Price (PKR)">
                <TextInput name="quotePkr" defaultValue={minorToInput(r.quotePkr)} inputMode="decimal" placeholder="e.g. 150000" required />
              </FieldRow>
              <FieldRow label="Days to make">
                <TextInput name="quoteDays" defaultValue={r.quoteDays ?? ""} inputMode="numeric" required />
              </FieldRow>
              <FieldRow label="Message to the buyer" className="sm:col-span-2">
                <TextArea name="quoteMessage" defaultValue={r.quoteMessage ?? ""} rows={2} />
              </FieldRow>
              <Toggle name="notifyBuyer" label="Email the buyer" defaultChecked />
              <div className="sm:text-right">
                <SubmitButton variant="primary">Save quote</SubmitButton>
              </div>
            </ActionForm>
          </details>
        ) : null}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Status">
        <KV
          items={[
            ["Status", <StatusBadge key="s" kind="request" status={r.status} />],
            ["Age", <Badge key="a" tone={sla.tone} title={sla.note}>{sla.label} · {sla.note}</Badge>],
            ["Opened", formatDateTime(r.createdAt)],
            ["Artisan", r.vendor ? <Link key="v" href={`/admin/artisans/${r.vendor.id}`} className="text-indigo-800 hover:underline">{r.vendor.displayName}</Link> : "Not matched"],
            ["Order", order ? <Link key="o" href={`/admin/orders/${order.number}`} className="text-indigo-800 hover:underline">{order.number}</Link> : "—"],
          ]}
        />
      </Panel>

      {!closed ? (
        <Panel title={r.vendorId ? "Re-match artisan" : "Match to an artisan"} description="Verified artisans taking commissions; same category first, then by open workload.">
          <ActionForm key={r.vendorId ?? "none"} action={matchRequestAction} inline className="space-y-2">
            <input type="hidden" name="id" value={r.id} />
            <SelectInput name="vendorId" defaultValue={r.vendorId ?? suggested[0]?.id} aria-label="Artisan" required>
              {suggested.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.categoryId === r.categoryId ? "★ " : ""}
                  {a.name} — {a.craft} · {a.open} open{a.responseHours ? ` · replies ~${a.responseHours}h` : ""}
                </option>
              ))}
              {unavailable.length ? (
                <optgroup label="Not taking commissions">
                  {unavailable.map((a) => (
                    <option key={a.id} value={a.id} disabled>
                      {a.name} {a.vacation ? "(on holiday)" : "(custom orders off)"}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </SelectInput>
            <TextArea name="note" rows={2} className="min-h-14" placeholder="Note for the artisan (optional)" aria-label="Note" />
            <SubmitButton variant="primary" confirm={r.vendorId ? "Re-matching clears the current quote. Continue?" : undefined}>
              {r.vendorId ? "Re-match" : "Send to artisan"}
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      <Panel title="Update">
        <ActionForm key={r.status} action={requestStatusAction} inline className="space-y-2">
          <input type="hidden" name="id" value={r.id} />
          <SelectInput name="status" defaultValue={r.status === "converted" ? "accepted" : r.status} aria-label="Status">
            <option value="new">New</option>
            <option value="quoted">Quoted</option>
            <option value="accepted">Accepted by buyer</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </SelectInput>
          <TextInput name="reason" placeholder="Reason / note to the buyer (optional)" aria-label="Reason" />
          <Toggle name="notifyBuyer" label="Email the buyer when closing" />
          <SubmitButton>Update status</SubmitButton>
        </ActionForm>
        <ActionForm action={linkRequestOrderAction} inline className="mt-4 flex gap-2 border-t border-umber-200 pt-4">
          <input type="hidden" name="id" value={r.id} />
          <TextInput name="orderNumber" placeholder="Order number, e.g. WB-1004" defaultValue={order?.number ?? ""} aria-label="Order number" required />
          <SubmitButton>Link order</SubmitButton>
        </ActionForm>
      </Panel>

      <Panel title="Buyer">
        <KV
          items={[
            ["Name", r.name],
            ["Email", <a key="e" href={`mailto:${r.email}`} className="text-indigo-800 hover:underline">{r.email}</a>],
            ["Account", customer ? <Link key="c" href={`/admin/customers/${customer.id}`} className="text-indigo-800 hover:underline">View customer →</Link> : "Guest"],
          ]}
        />
      </Panel>
      <NotesPanel entity="request" entityId={r.id} currentUserId={staff.id} />
      <AuditTrail entity="request" entityId={r.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Custom requests", href: "/admin/requests" }, { label: r.number }]} />
      <PageHeader title={`Commission ${r.number}`} description={`${r.name} · ${destinationName(r.destinationCountry)}${r.category ? ` · ${r.category.name}` : ""}`} />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
