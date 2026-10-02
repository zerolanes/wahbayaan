import Link from "next/link";
import type { ReactNode } from "react";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { saveBuyerProtectionAction, saveEscrowAction } from "@/app/actions/admin/rates";
import {
  saveHomeSettingsAction,
  saveLoyaltySettingsAction,
  saveMaintenanceAction,
  savePayoutScheduleAction,
  saveReferralSettingsAction,
  saveSeoSettingsAction,
  saveSiteSettingsAction,
} from "@/app/actions/admin/settings";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { Panel } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditLog, users, vendors } from "@/lib/db/schema";
import { getSettings, type SettingKey } from "@/lib/settings";
import { minorToInput } from "@/lib/admin/money";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "store", label: "Store info", keys: ["site"] },
  { id: "seo", label: "Search & sharing", keys: ["seo"] },
  { id: "home", label: "Homepage hero", keys: ["home"] },
  { id: "protection", label: "Escrow & buyer protection", keys: ["escrow", "buyer_protection"] },
  { id: "payouts", label: "Payout schedule", keys: ["payouts"] },
  { id: "programmes", label: "Referrals & loyalty", keys: ["referral", "loyalty"] },
  { id: "maintenance", label: "Maintenance mode", keys: ["maintenance"] },
] as const;

const KEYS = [...new Set(SECTIONS.flatMap((s) => s.keys))] as SettingKey[];

function StatusPill({ status }: { status: string }) {
  return <Badge tone={status === "active" ? "success" : status === "pending" ? "pending" : "neutral"}>{status === "active" ? "Active" : status === "pending" ? "Pending" : "Disabled"}</Badge>;
}

export default async function SettingsPage() {
  const user = await requireStaff("settings.manage");
  const canRates = user.permissions.has("rates.manage");
  const d = await db();
  const [s, allVendors, history] = await Promise.all([
    getSettings(["site", "seo", "home", "escrow", "buyer_protection", "payouts", "referral", "loyalty", "maintenance"]),
    d.select({ id: vendors.id, name: vendors.displayName, status: vendors.status }).from(vendors).orderBy(asc(vendors.displayName)),
    d
      .select({ entityId: auditLog.entityId, createdAt: auditLog.createdAt, actor: users.name, summary: auditLog.summary })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(and(eq(auditLog.entity, "setting"), inArray(auditLog.entityId, KEYS)))
      .orderBy(desc(auditLog.createdAt))
      .limit(300),
  ]);

  const lastSaved = (keys: readonly string[]): ReactNode => {
    const h = history.find((x) => x.entityId && keys.includes(x.entityId));
    if (!h) return <span className="text-xs text-umber-400">Never changed — using defaults</span>;
    return (
      <Link href={`/admin/audit?entity=setting&entityId=${h.entityId}`} className="text-xs text-umber-500 hover:text-umber-900" title={`${h.summary} · ${formatDateTime(h.createdAt)}`}>
        Saved {timeAgo(h.createdAt)} by {h.actor ?? "System"}
      </Link>
    );
  };
  const sec = (id: (typeof SECTIONS)[number]["id"]) => SECTIONS.find((x) => x.id === id)!;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Settings" description="Store-wide configuration. Each section saves on its own and is recorded in the audit log with the exact fields changed." />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="top-20 space-y-0.5 text-sm lg:sticky" aria-label="Settings sections">
          {SECTIONS.map((x) => (
            <a key={x.id} href={`#${x.id}`} className="block rounded-md px-3 py-1.5 text-umber-600 hover:bg-umber-100 hover:text-umber-900">
              {x.label}
            </a>
          ))}
          <div className="my-2 border-t border-umber-200" />
          <Link href="/admin/flags" className="block rounded-md px-3 py-1.5 text-umber-600 hover:bg-umber-100 hover:text-umber-900">
            Feature flags →
          </Link>
          <Link href="/admin/rates/fees" className="block rounded-md px-3 py-1.5 text-umber-600 hover:bg-umber-100 hover:text-umber-900">
            Fees & commission →
          </Link>
          <Link href="/admin/rates/fx" className="block rounded-md px-3 py-1.5 text-umber-600 hover:bg-umber-100 hover:text-umber-900">
            FX markup →
          </Link>
        </nav>

        <div className="min-w-0 space-y-6">
          <section id="store" className="scroll-mt-24">
            <Panel title={sec("store").label} description="Shown in the footer, emails and the contact page." action={lastSaved(sec("store").keys)}>
              <ActionForm action={saveSiteSettingsAction} className="grid gap-4 md:grid-cols-2">
                <FieldRow label="Store name">
                  <TextInput name="name" defaultValue={s.site.name} required />
                </FieldRow>
                <FieldRow label="Support email">
                  <TextInput name="supportEmail" type="email" defaultValue={s.site.supportEmail} required />
                </FieldRow>
                <FieldRow label="WhatsApp" hint="International format, e.g. +92 300 1234567">
                  <TextInput name="whatsapp" defaultValue={s.site.whatsapp ?? ""} />
                </FieldRow>
                <FieldRow label="Instagram URL">
                  <TextInput name="instagram" defaultValue={s.site.instagram ?? ""} placeholder="https://instagram.com/…" />
                </FieldRow>
                <FieldRow label="Pinterest URL">
                  <TextInput name="pinterest" defaultValue={s.site.pinterest ?? ""} placeholder="https://pinterest.com/…" />
                </FieldRow>
                <div className="md:col-span-2">
                  <SubmitButton>Save store info</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          </section>

          <section id="seo" className="scroll-mt-24">
            <Panel title={sec("seo").label} description="Defaults for page titles and link previews." action={lastSaved(sec("seo").keys)}>
              <ActionForm action={saveSeoSettingsAction} className="space-y-4">
                <FieldRow label="Title suffix" hint={`Pages render as “Page name · ${s.seo.titleSuffix}”`}>
                  <TextInput name="titleSuffix" defaultValue={s.seo.titleSuffix} required className="max-w-sm" />
                </FieldRow>
                <FieldRow label="Default description" hint={`${s.seo.defaultDescription.length}/300 characters · aim for 120–160`}>
                  <TextArea name="defaultDescription" defaultValue={s.seo.defaultDescription} rows={3} maxLength={300} required />
                </FieldRow>
                <SubmitButton>Save search & sharing</SubmitButton>
              </ActionForm>
            </Panel>
          </section>

          <section id="home" className="scroll-mt-24">
            <Panel title={sec("home").label} description="The first thing buyers read on the homepage." action={lastSaved(sec("home").keys)}>
              <ActionForm action={saveHomeSettingsAction} className="space-y-4">
                <FieldRow label="Eyebrow">
                  <TextInput name="heroEyebrow" defaultValue={s.home.heroEyebrow} required />
                </FieldRow>
                <FieldRow label="Headline">
                  <TextInput name="heroTitle" defaultValue={s.home.heroTitle} required />
                </FieldRow>
                <FieldRow label="Subtitle">
                  <TextArea name="heroSubtitle" defaultValue={s.home.heroSubtitle} rows={2} required />
                </FieldRow>
                <FieldRow label="Featured artisans" hint="Only verified artisans that pass the visibility guards are shown publicly.">
                  <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-umber-200 p-3 sm:grid-cols-2">
                    {allVendors.length ? (
                      allVendors.map((v) => (
                        <Toggle
                          key={v.id}
                          name="featuredVendorIds[]"
                          value={v.id}
                          defaultChecked={s.home.featuredVendorIds.includes(v.id)}
                          label={
                            <>
                              {v.name} {v.status !== "verified" ? <span className="text-xs text-umber-400">({v.status.replace("_", " ")})</span> : null}
                            </>
                          }
                        />
                      ))
                    ) : (
                      <p className="text-sm text-umber-500">No artisans yet.</p>
                    )}
                  </div>
                </FieldRow>
                <SubmitButton>Save homepage hero</SubmitButton>
              </ActionForm>
            </Panel>
          </section>

          <section id="protection" className="scroll-mt-24">
            <Panel title={sec("protection").label} description="How long buyer funds are held after delivery, and the return window promised to buyers." action={lastSaved(sec("protection").keys)}>
              {!canRates ? <Notice tone="pending" className="mb-4">Changing these needs the “rates.manage” permission.</Notice> : null}
              <div className="grid gap-6 md:grid-cols-2">
                <ActionForm action={saveEscrowAction} className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-umber-900">
                    Escrow auto-release <StatusPill status={s.escrow.status} />
                  </p>
                  <FieldRow label="Days after delivery" hint="Funds release automatically unless a dispute is opened.">
                    <TextInput name="days" type="number" min={1} max={90} defaultValue={s.escrow.autoReleaseDaysAfterDelivery} disabled={!canRates} className="w-28" />
                  </FieldRow>
                  <Toggle name="confirmed" label="Confirmed business decision" defaultChecked={s.escrow.status === "active"} disabled={!canRates} />
                  {canRates ? <SubmitButton>Save escrow</SubmitButton> : null}
                </ActionForm>
                <ActionForm action={saveBuyerProtectionAction} className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-umber-900">
                    Return window <StatusPill status={s.buyer_protection.status} />
                  </p>
                  <FieldRow label="Days after delivery" hint="Shown on product pages and the buyer-protection page. Empty = pending.">
                    <TextInput name="days" type="number" min={0} max={365} defaultValue={s.buyer_protection.returnWindowDays ?? ""} placeholder="Pending" disabled={!canRates} className="w-28" />
                  </FieldRow>
                  <Toggle name="confirmed" label="Confirmed business decision" defaultChecked={s.buyer_protection.status === "active"} disabled={!canRates} />
                  {canRates ? <SubmitButton>Save return window</SubmitButton> : null}
                </ActionForm>
              </div>
            </Panel>
          </section>

          <section id="payouts" className="scroll-mt-24">
            <Panel title={sec("payouts").label} description="How often finance batches artisan bank transfers (PKR)." action={lastSaved(sec("payouts").keys)}>
              <ActionForm action={savePayoutScheduleAction} className="grid gap-4 md:grid-cols-4">
                <FieldRow label="Status">
                  <SelectInput name="status" defaultValue={s.payouts.status}>
                    <option value="pending">Pending — not decided</option>
                    <option value="active">Confirmed</option>
                  </SelectInput>
                </FieldRow>
                <FieldRow label="Schedule">
                  <SelectInput name="schedule" defaultValue={s.payouts.schedule}>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Every two weeks</option>
                    <option value="monthly">Monthly</option>
                  </SelectInput>
                </FieldRow>
                <FieldRow label="Minimum payout (Rs)" hint="Smaller balances roll over">
                  <TextInput name="minimumPkr" inputMode="decimal" defaultValue={minorToInput(s.payouts.minimumPkr)} placeholder="Pending" />
                </FieldRow>
                <FieldRow label="Note for artisans">
                  <TextInput name="note" defaultValue={s.payouts.note ?? ""} placeholder="e.g. Transfers go out on Fridays" />
                </FieldRow>
                <div className="md:col-span-4">
                  <SubmitButton>Save payout schedule</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          </section>

          <section id="programmes" className="scroll-mt-24">
            <Panel title={sec("programmes").label} description="Point values stay pending until the business sets them — nothing is promised to buyers before then." action={lastSaved(sec("programmes").keys)}>
              <div className="grid gap-6 md:grid-cols-2">
                <ActionForm action={saveReferralSettingsAction} className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-umber-900">
                    Referrals <StatusPill status={s.referral.status} />
                  </p>
                  <FieldRow label="Status">
                    <SelectInput name="status" defaultValue={s.referral.status}>
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </SelectInput>
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Referrer points">
                      <TextInput name="referrerPoints" type="number" min={0} defaultValue={s.referral.referrerPoints} />
                    </FieldRow>
                    <FieldRow label="New buyer points">
                      <TextInput name="refereePoints" type="number" min={0} defaultValue={s.referral.refereePoints} />
                    </FieldRow>
                  </div>
                  <SubmitButton>Save referrals</SubmitButton>
                </ActionForm>
                <ActionForm action={saveLoyaltySettingsAction} className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-umber-900">
                    Loyalty <StatusPill status={s.loyalty.status} />
                  </p>
                  <FieldRow label="Status">
                    <SelectInput name="status" defaultValue={s.loyalty.status}>
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </SelectInput>
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Points per unit spent">
                      <TextInput name="pointsPerUnit" type="number" min={0} defaultValue={s.loyalty.pointsPerUnit} />
                    </FieldRow>
                    <FieldRow label="Value of a point (minor units)" hint="e.g. 1 = one cent / penny">
                      <TextInput name="pointValueMinor" type="number" min={0} defaultValue={s.loyalty.pointValueMinor} />
                    </FieldRow>
                  </div>
                  <SubmitButton>Save loyalty</SubmitButton>
                </ActionForm>
              </div>
            </Panel>
          </section>

          <section id="maintenance" className="scroll-mt-24">
            <Panel
              title={
                <span className="flex items-center gap-2">
                  {sec("maintenance").label} {s.maintenance.enabled ? <Badge tone="danger">On</Badge> : <Badge tone="neutral">Off</Badge>}
                </span>
              }
              description="Pause the storefront with a short message while you make changes. The admin stays available."
              action={lastSaved(sec("maintenance").keys)}
            >
              <Notice tone="indigo" className="mb-4">
                While it&apos;s on, visitors see a holding page with this message. Signed-in staff still see the full site, and the sign-in page stays open.
              </Notice>
              <ActionForm action={saveMaintenanceAction} className="space-y-3" confirm={s.maintenance.enabled ? undefined : "Save maintenance settings? If switched on, buyers will see the maintenance message."}>
                <Toggle name="enabled" label="Maintenance mode on" defaultChecked={s.maintenance.enabled} />
                <FieldRow label="Message shown to buyers">
                  <TextInput name="message" defaultValue={s.maintenance.message} required />
                </FieldRow>
                <SubmitButton variant={s.maintenance.enabled ? "primary" : "outline"}>Save maintenance mode</SubmitButton>
              </ActionForm>
            </Panel>
          </section>
        </div>
      </div>
    </div>
  );
}
