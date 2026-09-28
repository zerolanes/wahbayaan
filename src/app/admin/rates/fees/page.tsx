import Link from "next/link";
import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { Calculator } from "lucide-react";
import { saveCommissionAction, saveGiftWrapAction, saveHandlingFeeAction } from "@/app/actions/admin/rates";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { RatesTabs } from "@/components/admin/rates";
import { KV, MiniStat, Panel } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, products, vendors } from "@/lib/db/schema";
import { getSettings, type SettingsShape } from "@/lib/settings";
import { computeLandedCost, type LandedCost } from "@/lib/commerce/landed-cost";
import { getRateContext } from "@/lib/commerce/rates";
import { bpsToPercentString, minorToInput } from "@/lib/admin/money";
import { int, str } from "@/lib/admin/params";
import { DESTINATIONS, destinationName, formatMoney, isDestination, type Currency } from "@/lib/money/currency";
import { formatWeight } from "@/lib/utils/format";

export const metadata = { title: "Fees & commission" };

type S = Pick<SettingsShape, "handling_fee" | "commission" | "gift_wrap">;

function describeHandling(h: S["handling_fee"]) {
  if (h.status === "pending") return "Pending";
  if (h.kind === "fixed") return `${formatMoney(h.amount, h.currency)} ${h.currency} per order`;
  return h.percentBps ? `${bpsToPercentString(h.percentBps)}% of items` : "None";
}

function money(amount: number, currency: Currency) {
  return `${formatMoney(amount, currency, { cents: true })} ${currency}`;
}

async function preview(productId: string, destination: string, qty: number, gift: boolean) {
  const d = await db();
  const [row] = await d
    .select({ p: products, hsCode: categories.hsCode, vendor: vendors.displayName, category: categories.name })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(eq(products.id, productId));
  if (!row) return { error: "Listing not found." } as const;
  const currency = DESTINATIONS.find((x) => x.code === destination)!.currency;
  const rates = await getRateContext(destination);
  const fx = rates.fxTable[currency];
  if (!fx) return { error: `No ${currency} exchange rate is stored, so nothing can be priced for ${destinationName(destination)}. Set it under Exchange rates.` } as const;
  const lc = computeLandedCost({
    items: [
      {
        productId: row.p.id,
        vendorId: row.p.vendorId,
        categoryId: row.p.categoryId,
        hsCode: row.p.hsCodeOverride ?? row.hsCode,
        title: row.p.title,
        unitPricePkr: row.p.pricePkr,
        qty,
        weightG: row.p.weightG,
        availability: row.p.availability,
        timeToMakeDays: row.p.timeToMakeDays,
        dispatchDays: row.p.dispatchDays,
      },
    ],
    destination,
    fx,
    fxTable: rates.fxTable,
    shippingRates: rates.shippingRates,
    dutyRates: rates.dutyRates,
    handling: rates.handling,
    giftWrap: { selected: gift, setting: rates.giftWrap },
  });
  return { lc, row } as const;
}

function PreviewResult({ lc, row }: { lc: LandedCost; row: { p: typeof products.$inferSelect; vendor: string; category: string; hsCode: string | null } }) {
  const ship = lc.shipments[0];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-lg border border-umber-200">
        <Table>
          <THead>
            <tr>
              <Th>Line</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount ({lc.currency})</Th>
            </tr>
          </THead>
          <TBody>
            {lc.lines.map((l) => (
              <Tr key={l.key}>
                <Td>
                  <p className="text-umber-900">{l.label}</p>
                  {l.note ? <p className="text-xs text-umber-500">{l.note}</p> : null}
                </Td>
                <Td>{l.status === "known" ? <Badge tone="success">Known</Badge> : l.status === "pending" ? <Badge tone="pending">Pending</Badge> : <Badge tone="neutral">Not applicable</Badge>}</Td>
                <Td className="text-right whitespace-nowrap tabular-nums">{l.status === "pending" ? <Badge tone="pending">Pending</Badge> : l.amount == null ? "—" : money(l.amount, lc.currency)}</Td>
              </Tr>
            ))}
            <tr className="border-t border-umber-300 bg-umber-50">
              <Td className="font-medium text-umber-900">{lc.complete ? "Total" : "Known so far"}</Td>
              <Td>{lc.complete ? <Badge tone="success">Complete</Badge> : <Badge tone="pending">{lc.pendingLines.length} pending</Badge>}</Td>
              <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{money(lc.knownTotal, lc.currency)}</Td>
            </tr>
          </TBody>
        </Table>
      </div>
      <div className="space-y-3 text-sm">
        <KV
          items={[
            ["Listing", <Link key="l" href={`/admin/listings/${row.p.id}`} className="hover:underline">{row.p.title}</Link>],
            ["Artisan", row.vendor],
            ["Craft · HS", `${row.category} · ${row.p.hsCodeOverride ?? row.hsCode ?? "no HS code"}`],
            ["Price (seller)", <SellerPrice key="p" pkr={row.p.pricePkr} />],
            ["Weight", row.p.weightG ? formatWeight(row.p.weightG)?.metric : <Badge key="w" tone="pending">Missing</Badge>],
            ["FX used", `1 ${lc.currency} = Rs ${lc.fx.pkrPerUnit.toFixed(2)} (${lc.fx.status})`],
            ["Courier", ship?.status === "known" ? `${ship.courier}${ship.serviceName ? ` · ${ship.serviceName}` : ""}` : <span key="c" className="text-umber-500">{ship?.reason ?? "—"}</span>],
            ["Delivery", lc.delivery.status === "pending" ? <Badge key="d" tone="pending">Pending</Badge> : `${lc.delivery.productionDaysMax != null ? `${lc.delivery.productionDaysMax}d making` : "making time pending"} + ${lc.delivery.transitDaysMax != null ? `${lc.delivery.transitDaysMin ?? "?"}–${lc.delivery.transitDaysMax}d transit` : "transit pending"}`],
          ]}
        />
      </div>
    </div>
  );
}

export default async function FeesPage(props: PageProps<"/admin/rates/fees">) {
  const user = await requireStaff("rates.view");
  const canManage = user.permissions.has("rates.manage");
  const params = await props.searchParams;
  const d = await db();
  const [s, overrides, listingOptions] = await Promise.all([
    getSettings(["handling_fee", "commission", "gift_wrap"]),
    d.select({ n: sql<number>`count(*)::int` }).from(vendors).where(isNotNull(vendors.commissionBps)),
    d
      .select({ id: products.id, title: products.title, status: products.status, vendor: vendors.displayName })
      .from(products)
      .innerJoin(vendors, eq(vendors.id, products.vendorId))
      .orderBy(asc(products.title))
      .limit(1000),
  ]);
  const h = s.handling_fee;
  const c = s.commission;
  const g = s.gift_wrap;

  const pid = str(params, "product");
  const dest = isDestination(str(params, "destination")) ? str(params, "destination") : "US";
  const qty = Math.min(20, Math.max(1, int(params, "qty", 1)));
  const gift = str(params, "gift") === "1";
  const result = pid && /^[0-9a-f-]{36}$/i.test(pid) ? await preview(pid, dest, qty, gift) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Cross-border" title="Fees & commission" description="Business decisions that feed every quote and payout. Anything not decided stays “Pending” — buyers see it as pending, never as zero." />
      <RatesTabs active="/admin/rates/fees" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Handling fee (buyer)" value={describeHandling(h)} tone={h.status === "pending" ? "pending" : undefined} />
        <MiniStat label="Default commission (artisan)" value={c.status === "active" ? `${bpsToPercentString(c.defaultBps)}%` : "Pending"} tone={c.status === "pending" ? "pending" : undefined} hint={`${overrides[0]?.n ?? 0} artisan override(s)`} />
        <MiniStat label="Gift wrap" value={g.status === "active" ? `${formatMoney(g.amount, g.currency)} ${g.currency}` : g.status === "disabled" ? "Off" : "Pending"} tone={g.status === "pending" ? "pending" : undefined} />
        <MiniStat label="Escrow & returns" value="Settings" hint="Auto-release and return window" href="/admin/settings#protection" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Handling fee" description="Wahbayaan's fee on each order, shown to buyers as its own line.">
          {canManage ? (
            <ActionForm action={saveHandlingFeeAction} className="space-y-3">
              <FieldRow label="Mode">
                <SelectInput name="mode" defaultValue={h.status === "pending" ? "pending" : h.kind === "fixed" ? "fixed" : h.percentBps ? "percent" : "none"}>
                  <option value="pending">Pending — not decided</option>
                  <option value="none">No handling fee</option>
                  <option value="fixed">Fixed amount per order</option>
                  <option value="percent">Percentage of items</option>
                </SelectInput>
              </FieldRow>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <FieldRow label="Fixed amount">
                  <TextInput name="amount" inputMode="decimal" defaultValue={h.status === "active" && h.kind === "fixed" ? minorToInput(h.amount) : ""} />
                </FieldRow>
                <FieldRow label="Currency">
                  <SelectInput name="currency" defaultValue={h.status === "active" && h.kind === "fixed" ? h.currency : "USD"}>
                    {["USD", "GBP", "CAD", "PKR"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </SelectInput>
                </FieldRow>
              </div>
              <FieldRow label="Percentage">
                <TextInput name="percent" inputMode="decimal" defaultValue={h.status === "active" && h.kind === "percent" ? bpsToPercentString(h.percentBps) : ""} placeholder="e.g. 3" />
              </FieldRow>
              <SubmitButton>Save handling fee</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm">{describeHandling(h)}</p>
          )}
        </Panel>

        <Panel title="Artisan commission" description="Deducted from the PKR subtotal before payout. Per-artisan overrides live on each artisan.">
          {canManage ? (
            <ActionForm action={saveCommissionAction} className="space-y-3">
              <FieldRow label="Status">
                <SelectInput name="mode" defaultValue={c.status}>
                  <option value="pending">Pending — no payouts can be calculated</option>
                  <option value="active">Active</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label="Default commission %">
                <TextInput name="percent" inputMode="decimal" defaultValue={c.status === "active" ? bpsToPercentString(c.defaultBps) : ""} placeholder="e.g. 15" />
              </FieldRow>
              <SubmitButton>Save commission</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm">{c.status === "active" ? `${bpsToPercentString(c.defaultBps)}%` : "Pending"}</p>
          )}
          {c.status === "pending" ? (
            <p className="mt-3 text-xs text-pending-600">
              While pending, released orders wait in{" "}
              <Link href="/admin/payouts" className="underline">
                Artisan payouts
              </Link>
              .
            </p>
          ) : null}
        </Panel>

        <Panel title="Gift wrap" description="Optional add-on at checkout.">
          {canManage ? (
            <ActionForm action={saveGiftWrapAction} className="space-y-3">
              <FieldRow label="Status">
                <SelectInput name="mode" defaultValue={g.status}>
                  <option value="pending">Pending — price not set</option>
                  <option value="disabled">Not offered</option>
                  <option value="active">Offered</option>
                </SelectInput>
              </FieldRow>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <FieldRow label="Price">
                  <TextInput name="amount" inputMode="decimal" defaultValue={g.status === "active" ? minorToInput(g.amount) : ""} />
                </FieldRow>
                <FieldRow label="Currency">
                  <SelectInput name="currency" defaultValue={g.status === "active" ? g.currency : "USD"}>
                    {["USD", "GBP", "CAD", "PKR"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </SelectInput>
                </FieldRow>
              </div>
              <SubmitButton>Save gift wrap</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm">{g.status}</p>
          )}
        </Panel>
      </div>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <Calculator className="size-4" /> Preview landed cost
          </span>
        }
        description="Runs the same landed-cost engine as the product page and checkout, with the rates currently stored."
      >
        <form method="get" action="/admin/rates/fees#preview" className="flex flex-wrap items-end gap-3" id="preview">
          <FieldRow label="Listing" className="min-w-72 flex-1">
            <SelectInput name="product" defaultValue={pid} required>
              <option value="">Choose a listing…</option>
              {listingOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.vendor}
                  {p.status !== "active" ? ` (${p.status.replace("_", " ")})` : ""}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label="Destination">
            <SelectInput name="destination" defaultValue={dest} className="w-44">
              {DESTINATIONS.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name} ({x.currency})
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label="Qty">
            <TextInput name="qty" type="number" min={1} max={20} defaultValue={qty} className="w-20" />
          </FieldRow>
          <label className="flex h-9 items-center gap-2 text-sm text-umber-700">
            <input type="checkbox" name="gift" value="1" defaultChecked={gift} className="size-4 accent-indigo-800" /> Gift wrap
          </label>
          <button className="h-9 rounded-lg bg-umber-900 px-3.5 text-sm font-medium text-white hover:bg-umber-800">Run preview</button>
        </form>
        <div className="mt-5">
          {!result ? (
            <p className="text-sm text-umber-500">Pick a listing and a destination to see every line a buyer would see — including which ones are still pending and why.</p>
          ) : "error" in result ? (
            <Notice tone="pending">{result.error}</Notice>
          ) : (
            <PreviewResult lc={result.lc} row={result.row} />
          )}
        </div>
      </Panel>
    </div>
  );
}
