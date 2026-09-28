import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Flag, Heart, MapPin, Star } from "lucide-react";
import { flagCustomerAction, setCustomerStatusAction, setWholesaleAction, unflagCustomerAction } from "@/app/actions/admin/customers";
import { adjustLoyaltyAction } from "@/app/actions/admin/referrals";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextArea, TextInput } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, KV, MiniStat, OrderAmount, Panel, StatusBadge, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import {
  addresses,
  contactMessages,
  conversations,
  customRequests,
  disputes,
  loyaltyLedger,
  messages,
  newsletterSubscribers,
  orderItems,
  orders,
  products,
  referralCodes,
  referralRedemptions,
  refunds,
  reviews,
  users,
  vendors,
  waitlistEntries,
  wishlistItems,
} from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { customerFlags } from "@/lib/admin/customers";
import { lifetimeValue } from "@/lib/admin/reports";
import { destinationName } from "@/lib/money/currency";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Customer" };

export default async function CustomerDetail(props: PageProps<"/admin/customers/[id]">) {
  const staff = await requireStaff("customers.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const u = await d.query.users.findFirst({ where: eq(users.id, id) });
  if (!u || u.role !== "buyer") notFound();
  const email = u.email.toLowerCase();
  const [orderRows, refundRows, addressRows, wishlist, reviewRows, refCode, redemptions, ledger, requests, tickets, convs, waitlist, newsletter, flags, disputeRows] = await Promise.all([
    d.select().from(orders).where(or(eq(orders.userId, u.id), eq(sql`lower(${orders.email})`, email))).orderBy(desc(orders.createdAt)),
    d
      .select({ currency: refunds.currency, amount: refunds.amount })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .where(and(eq(orders.userId, u.id), eq(refunds.status, "processed"), sql`${orders.status} <> 'refunded'`)),
    d.select().from(addresses).where(eq(addresses.userId, u.id)).orderBy(desc(addresses.isDefault)),
    d
      .select({ id: wishlistItems.id, createdAt: wishlistItems.createdAt, productId: products.id, title: products.title, slug: products.slug, status: products.status, pricePkr: products.pricePkr, cover: sql<string | null>`(select url from product_images i where i.product_id = ${products.id} order by sort limit 1)` })
      .from(wishlistItems)
      .innerJoin(products, eq(products.id, wishlistItems.productId))
      .where(eq(wishlistItems.ownerKey, `user:${u.id}`))
      .orderBy(desc(wishlistItems.createdAt)),
    d
      .select({ r: reviews, product: products.title })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .where(eq(reviews.userId, u.id))
      .orderBy(desc(reviews.createdAt)),
    d.query.referralCodes.findFirst({ where: eq(referralCodes.userId, u.id) }),
    d
      .select({ r: referralRedemptions, referrer: sql<string | null>`(select name from users x where x.id = ${referralRedemptions.referrerUserId})`, referred: sql<string | null>`(select name from users x where x.id = ${referralRedemptions.referredUserId})` })
      .from(referralRedemptions)
      .where(or(eq(referralRedemptions.referrerUserId, u.id), eq(referralRedemptions.referredUserId, u.id)))
      .orderBy(desc(referralRedemptions.createdAt)),
    d.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, u.id)).orderBy(desc(loyaltyLedger.createdAt)),
    d.select().from(customRequests).where(or(eq(customRequests.userId, u.id), eq(sql`lower(${customRequests.email})`, email))).orderBy(desc(customRequests.createdAt)),
    d.select().from(contactMessages).where(eq(sql`lower(${contactMessages.email})`, email)).orderBy(desc(contactMessages.createdAt)),
    d
      .select({ c: conversations, vendor: vendors.displayName, n: sql<number>`(select count(*)::int from ${messages} m where m.conversation_id = ${conversations.id})` })
      .from(conversations)
      .innerJoin(vendors, eq(vendors.id, conversations.vendorId))
      .where(eq(conversations.buyerId, u.id))
      .orderBy(desc(conversations.lastMessageAt)),
    d
      .select({ w: waitlistEntries, title: products.title })
      .from(waitlistEntries)
      .innerJoin(products, eq(products.id, waitlistEntries.productId))
      .where(or(eq(waitlistEntries.userId, u.id), eq(sql`lower(${waitlistEntries.email})`, email))),
    d.query.newsletterSubscribers.findFirst({ where: eq(sql`lower(${newsletterSubscribers.email})`, email) }),
    customerFlags(u.id),
    d.select().from(disputes).where(eq(disputes.userId, u.id)),
  ]);
  const referredOrders = refCode ? await d.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.referralCode, refCode.code)) : [{ n: 0 }];
  const refundedByCurrency: Record<string, number> = {};
  for (const r of refundRows) refundedByCurrency[r.currency] = (refundedByCurrency[r.currency] ?? 0) + r.amount;
  const ltv = lifetimeValue(
    orderRows.map((o) => ({ currency: o.currency, total: o.total, fx: Number(o.fxPkrPerUnit), paidAt: o.paidAt, status: o.status })),
    refundedByCurrency,
  );
  const balance = ledger.reduce((a, l) => a + l.points, 0);
  const can = (p: string) => staff.permissions.has(p);
  const itemCounts = orderRows.length
    ? await d.select({ orderId: orderItems.orderId, n: sql<number>`sum(${orderItems.qty})::int` }).from(orderItems).where(inArray(orderItems.orderId, orderRows.map((o) => o.id))).groupBy(orderItems.orderId)
    : [];

  const main = (
    <>
      {flags.length ? (
        <Notice tone="danger" title="Flagged customer" icon={<Flag className="size-4" />}>
          <ul className="list-disc pl-4">
            {flags.map((f) => (
              <li key={f.id}>
                {f.body} <span className="text-xs opacity-70">· {timeAgo(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {u.status !== "active" ? (
        <Notice tone="danger" title="Login disabled">
          This buyer can&apos;t sign in. Orders already placed continue as normal.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Lifetime value"
          value={
            ltv.byCurrency.length ? (
              <span className="flex flex-col">
                {ltv.byCurrency.map((c) => (
                  <OrderAmount key={c.currency} amount={c.total} currency={c.currency} />
                ))}
              </span>
            ) : (
              "—"
            )
          }
          hint={ltv.byCurrency.length ? <>≈ <SellerPrice pkr={ltv.pkr} /> at order rates</> : "No paid orders yet"}
        />
        <MiniStat label="Paid orders" value={String(ltv.paidOrders)} hint={`${orderRows.length} placed in total`} />
        <MiniStat label="Average order (PKR)" value={ltv.averagePkr != null ? <SellerPrice pkr={ltv.averagePkr} /> : "—"} hint="Paid orders, at order rates" />
        <MiniStat label="Loyalty balance" value={`${balance.toLocaleString("en-US")} pts`} hint={`${ledger.length} ledger entr${ledger.length === 1 ? "y" : "ies"}`} />
      </div>

      <Panel title={`Orders (${orderRows.length})`} description="Totals are in the order's currency; PKR at the order's recorded rate." bodyClassName="p-0">
        {orderRows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Placed · ship to</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">≈ PKR</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {orderRows.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link href={`/admin/orders/${o.number}`} className="font-medium text-indigo-800 hover:underline">
                      {o.number}
                    </Link>
                    {o.couponCode ? <p className="text-xs text-umber-500">Code {o.couponCode}</p> : null}
                  </Td>
                  <Td className="text-sm whitespace-nowrap text-umber-600">
                    {formatDate(o.createdAt)}
                    <p className="text-xs text-umber-500">
                      {o.destinationCountry} · {itemCounts.find((x) => x.orderId === o.id)?.n ?? 0} item{itemCounts.find((x) => x.orderId === o.id)?.n === 1 ? "" : "s"}
                    </p>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <OrderAmount amount={o.total} currency={o.currency} className="font-medium" />
                    {!o.totalComplete ? (
                      <div>
                        <Badge tone="pending">Lines pending</Badge>
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-right text-umber-600">
                    <SellerPrice pkr={Math.round(o.total * Number(o.fxPkrPerUnit))} />
                  </Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[o.status] ?? "neutral"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">No orders yet.</p>
        )}
        {disputeRows.length ? (
          <p className="border-t border-umber-200/60 px-5 py-3 text-sm text-umber-600">
            Cases opened:{" "}
            {disputeRows.map((x, i) => (
              <span key={x.id}>
                {i ? ", " : ""}
                <Link href={`/admin/disputes/${x.number}`} className="text-indigo-800 hover:underline">
                  {x.number}
                </Link>{" "}
                ({x.status.replace("_", " ")})
              </span>
            ))}
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Wishlist (${wishlist.length})`} description="Artisan prices in PKR" bodyClassName="p-0">
          {wishlist.length ? (
            <ul className="divide-y divide-umber-200/60">
              {wishlist.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Thumb src={w.cover} alt={w.title} size={36} kind={w.cover?.startsWith("/art/") ? "illustration" : "photo"} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/listings/${w.productId}`} className="block truncate text-umber-900 hover:underline">
                      {w.title}
                    </Link>
                    <p className="text-xs text-umber-500">Saved {timeAgo(w.createdAt)}</p>
                  </div>
                  <SellerPrice pkr={w.pricePkr} className="text-umber-700" />
                  {w.status !== "active" ? <StatusBadge kind="product" status={w.status} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-umber-500">
              <Heart className="size-4" /> Nothing saved.
            </p>
          )}
        </Panel>
        <Panel title={`Reviews (${reviewRows.length})`} bodyClassName="p-0">
          {reviewRows.length ? (
            <ul className="divide-y divide-umber-200/60">
              {reviewRows.slice(0, 6).map(({ r, product }) => (
                <li key={r.id} className="px-5 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-medium text-umber-900">
                      {r.rating}
                      <Star className="size-3.5 fill-current" /> · {product}
                    </span>
                    <StatusBadge kind="review" status={r.status} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-umber-600">{r.title ? `${r.title} — ` : ""}{r.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No reviews written.</p>
          )}
          {reviewRows.length > 6 ? (
            <Link href={`/admin/reviews?q=${encodeURIComponent(u.name)}`} className="block border-t border-umber-200/60 px-5 py-2.5 text-sm text-indigo-800 hover:underline">
              All {reviewRows.length} reviews →
            </Link>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Referrals" description={refCode ? <>Code <code className="font-mono">{refCode.code}</code></> : "No referral code created yet"}>
          <KV
            items={[
              ["Link visits", refCode ? String(refCode.uses) : "—"],
              ["Orders with their code", String(referredOrders[0]?.n ?? 0)],
              ["Redemptions", String(redemptions.length)],
            ]}
          />
          {redemptions.length ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {redemptions.map(({ r, referrer, referred }) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="text-umber-700">{r.referrerUserId === u.id ? `Referred ${referred ?? "a deleted account"}` : `Referred by ${referrer ?? "a deleted account"}`}</span>
                  <Badge tone={r.status === "awarded" ? "success" : r.status === "void" ? "neutral" : "pending"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href="/admin/referrals" className="mt-3 inline-block text-sm text-indigo-800 hover:underline">
            Referral programme →
          </Link>
        </Panel>
        <Panel title="Loyalty ledger" description={`Balance ${balance.toLocaleString("en-US")} points`} bodyClassName="p-0">
          {ledger.length ? (
            <ul className="max-h-64 divide-y divide-umber-200/60 overflow-y-auto">
              {ledger.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                  <span className="min-w-0 truncate text-umber-700">
                    {l.reason} <span className="text-xs text-umber-400">· {formatDate(l.createdAt)}</span>
                  </span>
                  <span className={`font-medium tabular-nums ${l.points < 0 ? "text-danger-700" : "text-success-700"}`}>
                    {l.points > 0 ? "+" : ""}
                    {l.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No points earned or spent.</p>
          )}
          {can("marketing.manage") ? (
            <ActionForm action={adjustLoyaltyAction} resetOnSuccess className="grid grid-cols-[5.5rem_1fr] gap-2 border-t border-umber-200/60 px-5 py-3">
              <input type="hidden" name="who" value={u.id} />
              <TextInput name="points" placeholder="± points" inputMode="numeric" aria-label="Points" required />
              <TextInput name="reason" placeholder="Reason (audited)" aria-label="Reason" required />
              <SubmitButton className="col-span-2 justify-self-end">Adjust points</SubmitButton>
            </ActionForm>
          ) : null}
        </Panel>
      </div>

      <Panel title="Support & requests" bodyClassName="p-0">
        {requests.length || tickets.length || convs.length || waitlist.length ? (
          <ul className="divide-y divide-umber-200/60 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  <Link href={`/admin/requests/${r.id}`} className="font-medium text-indigo-800 hover:underline">
                    {r.number}
                  </Link>{" "}
                  <span className="text-umber-600">Commission · {r.details}</span>
                </span>
                <StatusBadge kind="request" status={r.status} />
              </li>
            ))}
            {tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  <Link href={`/admin/inbox/${t.id}`} className="font-medium text-indigo-800 hover:underline">
                    {t.topic}
                  </Link>{" "}
                  <span className="text-umber-600">Support · {t.message}</span>
                </span>
                <StatusBadge kind="ticket" status={t.status} />
              </li>
            ))}
            {convs.map(({ c, vendor, n }) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  <Link href={`/admin/conversations/${c.id}`} className="font-medium text-indigo-800 hover:underline">
                    {c.subject}
                  </Link>{" "}
                  <span className="text-umber-600">
                    Conversation with {vendor} · {n} message{n === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="text-xs text-umber-500">{timeAgo(c.lastMessageAt)}</span>
              </li>
            ))}
            {waitlist.map(({ w, title }) => (
              <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  <Link href={`/admin/waitlists?product=${w.productId}`} className="font-medium text-indigo-800 hover:underline">
                    Waitlist
                  </Link>{" "}
                  <span className="text-umber-600">{title}</span>
                </span>
                <Badge tone={w.notifiedAt ? "success" : "pending"}>{w.notifiedAt ? "Notified" : "Waiting"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">No commissions, support messages, conversations or waitlists.</p>
        )}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Profile">
        <KV
          items={[
            ["Email", <a key="e" href={`mailto:${u.email}`} className="text-indigo-800 hover:underline">{u.email}</a>],
            ["Phone", u.phone ?? "—"],
            ["Country", u.country ? destinationName(u.country) : "Not set"],
            ["Currency", u.preferredCurrency ?? (ltv.primaryCurrency ? `${ltv.primaryCurrency} (from orders)` : "Default for country")],
            ["Signed up", formatDateTime(u.createdAt)],
            ["Last sign-in", u.lastLoginAt ? `${formatDateTime(u.lastLoginAt)}` : "Never recorded"],
            ["Login", <StatusBadge key="s" kind="account" status={u.status} label={u.status === "active" ? "Active" : "Disabled"} />],
            ["Wholesale", u.isWholesale ? <Badge key="w" tone="indigo">Trade account</Badge> : "Retail"],
            ["Marketing", u.marketingOptIn ? "Opted in" : "Not opted in"],
            ["Newsletter", newsletter ? `${newsletter.status} · ${newsletter.source ?? "unknown source"}` : "Not subscribed"],
          ]}
        />
      </Panel>

      {can("customers.manage") ? (
        <Panel title="Actions">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActionButton action={setWholesaleAction} fields={{ userId: u.id, on: u.isWholesale ? "0" : "1" }} confirm={u.isWholesale ? "Revoke wholesale pricing?" : "Grant wholesale pricing to this buyer?"}>
                {u.isWholesale ? "Revoke wholesale" : "Grant wholesale"}
              </ActionButton>
              {u.status !== "active" ? (
                <ActionButton action={setCustomerStatusAction} fields={{ userId: u.id, status: "active" }}>
                  Re-enable login
                </ActionButton>
              ) : null}
              {flags.length ? (
                <ActionButton action={unflagCustomerAction} fields={{ userId: u.id }} confirm="Clear every flag on this customer?">
                  Clear flag
                </ActionButton>
              ) : null}
            </div>
            <ActionForm action={flagCustomerAction} resetOnSuccess className="space-y-2">
              <input type="hidden" name="userId" value={u.id} />
              <TextArea name="reason" rows={2} className="min-h-14" placeholder="Why flag this customer? e.g. repeated chargebacks" aria-label="Flag reason" required />
              <SubmitButton variant="outline">
                <Flag className="size-3.5" /> Flag customer
              </SubmitButton>
            </ActionForm>
            {u.status === "active" ? (
              <ActionForm action={setCustomerStatusAction} className="space-y-2 border-t border-umber-200 pt-4">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="status" value="suspended" />
                <TextInput name="reason" placeholder="Reason for disabling login" aria-label="Reason" required />
                <SubmitButton variant="danger" confirm="Disable this buyer's login? They'll be signed out everywhere.">
                  Disable login
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title={`Addresses (${addressRows.length})`}>
        {addressRows.length ? (
          <ul className="space-y-3 text-sm">
            {addressRows.map((a) => (
              <li key={a.id} className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-umber-400" />
                <address className="text-umber-800 not-italic">
                  <span className="font-medium">{a.label ?? "Address"}</span>
                  {a.isDefault ? <Badge className="ml-1.5">Default</Badge> : null}
                  <br />
                  {a.fullName}, {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  <br />
                  {[a.city, a.region, a.postalCode].filter(Boolean).join(", ")} · {destinationName(a.country)}
                  {a.phone ? <> · {a.phone}</> : null}
                </address>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-umber-500">No saved addresses.</p>
        )}
      </Panel>

      <NotesPanel entity="customer" entityId={u.id} currentUserId={staff.id} />
      <AuditTrail entity="customer" entityId={u.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Customers", href: "/admin/customers" }, { label: u.name }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {u.name}
            {flags.length ? <Badge tone="danger"><Flag className="size-3" />Flagged</Badge> : null}
            {u.isWholesale ? <Badge tone="indigo">Wholesale</Badge> : null}
            <DemoBadge show={u.isDemo} />
          </span>
        }
        description={`${u.email} · ${u.country ? destinationName(u.country) : "country not set"} · customer since ${formatDate(u.createdAt)}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
