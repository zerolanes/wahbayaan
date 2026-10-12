import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AnalyticsTabs } from "@/components/admin/analytics";
import { FieldRow, SelectInput, TextInput, Toggle } from "@/components/admin/controls";
import { KV, Panel } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { BANNER_LAYOUTS, LAYOUT_LABELS } from "@/lib/consent/banner-settings";
import { GEO_PROVIDERS, GEO_PROVIDER_LABELS } from "@/lib/analytics/settings-shape";
import { apiKeys } from "@/lib/analytics/geo";
import { storageCounts } from "@/lib/analytics/stats";
import { getAnalyticsSettings, getConsentBanner } from "@/lib/analytics/store";
import {
  bumpConsentVersionAction,
  deleteAllVisitorDataAction,
  deleteConsentDataAction,
  runCleanupNowAction,
  saveAnalyticsSettingsAction,
  saveBannerPresetAction,
  saveGeoKeysAction,
} from "@/app/actions/admin/analytics";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Privacy & tracking" };

export default async function AnalyticsSettingsPage() {
  await requireStaff("analytics.manage");
  const [s, banner, keys, stored, maintenance, counts] = await Promise.all([getAnalyticsSettings(), getConsentBanner(), apiKeys(), getSetting("analytics_secrets"), getSetting("analytics_maintenance"), storageCounts()]);
  const keyState = (value: string | null, fromSettings: string | null, env: string) =>
    value ? <Badge tone="success">{fromSettings ? "Set" : `Set (env ${env})`}</Badge> : <Badge tone="neutral">Not set</Badge>;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Privacy & tracking" description="Location lookups, retention, the consent version and visitor-data deletion. Changes are audited." />
      <AnalyticsTabs active="/admin/analytics/settings" />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Location & retention" description="Location comes from Cloudflare's headers when the site is behind Cloudflare; otherwise from the provider below, cached 24 hours per IP and looked up after the response is sent.">
          <ActionForm action={saveAnalyticsSettingsAction} className="space-y-4">
            <FieldRow label="IP-location provider">
              <SelectInput name="geoProvider" defaultValue={s.geoProvider}>
                {GEO_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {GEO_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-3">
              <FieldRow label="Keep visits (days)" hint="Default 90">
                <TextInput name="retentionDays" type="number" min={1} max={3650} defaultValue={s.retentionDays} />
              </FieldRow>
              <FieldRow label="Page-view cap" hint="Oldest removed first">
                <TextInput name="maxPageViews" type="number" min={1000} max={100000000} defaultValue={s.maxPageViews} />
              </FieldRow>
              <FieldRow label="Keep consent records (days)" hint="Default 1095 (3 years)">
                <TextInput name="consentRetentionDays" type="number" min={30} max={7300} defaultValue={s.consentRetentionDays} />
              </FieldRow>
            </div>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Provider keys" description="Stored on the server only — never sent to the browser. Leave a field empty to keep the current key. Environment variables IPINFO_TOKEN / IP2LOCATION_KEY work too.">
          <KV
            className="mb-4"
            items={[
              ["ipapi.co", <Badge key="a" tone="success">No key needed</Badge>],
              ["ipinfo.io token", keyState(keys.ipinfoToken, stored.ipinfoToken, "IPINFO_TOKEN")],
              ["IP2Location.io key", keyState(keys.ip2locationKey, stored.ip2locationKey, "IP2LOCATION_KEY")],
            ]}
          />
          <ActionForm action={saveGeoKeysAction} className="space-y-4" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="New ipinfo.io token">
                <TextInput name="ipinfoToken" type="password" autoComplete="off" placeholder={stored.ipinfoToken ? "•••••••• (set)" : ""} />
              </FieldRow>
              <FieldRow label="New IP2Location.io key">
                <TextInput name="ip2locationKey" type="password" autoComplete="off" placeholder={stored.ip2locationKey ? "•••••••• (set)" : ""} />
              </FieldRow>
            </div>
            <div className="flex flex-wrap gap-4">
              <Toggle name="clearIpinfo" label="Remove ipinfo.io token" />
              <Toggle name="clearIp2location" label="Remove IP2Location.io key" />
            </div>
            <SubmitButton>Save keys</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Consent version" description="Raise the version after adding a service or changing what you collect: every visitor is asked again and the old choices stop counting.">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-umber-700">
              Current version <strong className="text-2xl font-semibold text-umber-900 tabular-nums">{s.consentRev}</strong>
            </p>
            <ActionForm action={bumpConsentVersionAction} confirm={`Raise the consent version to ${s.consentRev + 1}? Every visitor will see the banner again.`}>
              <SubmitButton variant="outline">Raise to version {s.consentRev + 1}</SubmitButton>
            </ActionForm>
          </div>
        </Panel>

        <Panel title="Banner options" description={<>Layout preset and the floating privacy button. Texts, colours and sizes: <Link className="underline" href="/admin/privacy/banner">Cookie banner</Link>.</>}>
          <ActionForm action={saveBannerPresetAction} className="space-y-4">
            <FieldRow label="Layout preset">
              <SelectInput name="layout" defaultValue={banner.layout}>
                {BANNER_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {LAYOUT_LABELS[l]}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <Toggle name="floatingButton" defaultChecked={banner.floatingButton} label="Show the floating privacy button (bottom-left) after a choice" />
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Storage & cleanup" description="The cleanup runs by itself at most once a day (triggered by visitor traffic), and from /api/cron/analytics-cleanup if a scheduler calls it.">
          <KV
            items={[
              ["Visits stored", counts.visits.toLocaleString("en-US")],
              ["Page views stored", `${counts.pageViews.toLocaleString("en-US")} of ${s.maxPageViews.toLocaleString("en-US")} cap`],
              ["Consent records", counts.consentRecords.toLocaleString("en-US")],
              ["Oldest visit", counts.oldestVisit ? formatDate(counts.oldestVisit) : "—"],
              ["Last cleanup", maintenance.lastCleanupAt ? formatDateTime(maintenance.lastCleanupAt) : "Not run yet"],
              ["Result", maintenance.lastSummary ?? "—"],
            ]}
          />
          <ActionForm action={runCleanupNowAction} className="mt-4">
            <SubmitButton variant="outline">Run cleanup now</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Delete visitor data" description="For a visitor's deletion request use their consent id (shown in their floating privacy menu). All deletions are audited.">
          <ActionForm action={deleteConsentDataAction} className="space-y-3" resetOnSuccess>
            <FieldRow label="Consent id">
              <TextInput name="consentId" required pattern="[A-Za-z0-9_-]{8,64}" autoComplete="off" />
            </FieldRow>
            <Toggle name="includeRecords" label="Also delete this visitor's consent records" />
            <SubmitButton variant="outline" confirm="Delete the data stored for this consent id?">
              Delete by consent id
            </SubmitButton>
          </ActionForm>
          <div className="mt-6 border-t border-umber-200 pt-5">
            <Notice tone="danger" title="Delete all visitor data">
              Removes every visit, page view and the location cache. Consent records are kept as proof unless you tick the box. This cannot be undone.
            </Notice>
            <ActionForm action={deleteAllVisitorDataAction} className="mt-3 space-y-3" resetOnSuccess>
              <FieldRow label='Type "DELETE" to confirm'>
                <TextInput name="confirm" autoComplete="off" required />
              </FieldRow>
              <Toggle name="includeRecords" label="Also delete all consent records" />
              <SubmitButton variant="danger" confirm="Delete all visitor data? This cannot be undone.">
                Delete all visitor data
              </SubmitButton>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </div>
  );
}
